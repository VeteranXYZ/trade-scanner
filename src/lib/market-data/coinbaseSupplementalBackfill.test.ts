import type { Candle } from "@/lib/shared/timeframes";
import { describe, expect, it, vi } from "vitest";
import {
  backfillCoinbaseCandlesForSymbol,
  type CoinbaseBackfillStore,
} from "./coinbaseSupplementalBackfill";
import type { MarketDataProvider } from "./marketDataProvider";
import type { PgSymbol } from "@/lib/storage/postgres/marketDataPg";

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const monday = Date.UTC(2026, 0, 5);

describe("Coinbase supplemental candle backfill", () => {
  it("uses planner windows and normalizes candles before upsert", async () => {
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => {
      const candles =
        request.startTime === 0
          ? [
              makeCandle(0, { close: 101 }),
              makeCandle(0, { close: 202 }),
              makeCandle(hourMs),
            ]
          : [makeCandle(2 * hourMs), makeCandle(4 * hourMs)];

      return {
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: "ABC-USDC",
        providerSymbol: "ABC/USDC",
        timeframe: request.timeframe,
        candles,
      };
    });
    const upserted: Candle[][] = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserted.push(input.candles);
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "1h",
      targetCandles: 5,
      providerMaxCandlesPerRequest: 3,
      endTimeMs: 4 * hourMs,
    });

    expect(fetchCandles).toHaveBeenCalledTimes(2);
    expect(fetchCandles.mock.calls.map(([request]) => ({
      startTime: request.startTime,
      endTime: request.endTime,
      limit: request.limit,
    }))).toEqual([
      { startTime: 0, endTime: hourMs, limit: 2 },
      { startTime: 2 * hourMs, endTime: 4 * hourMs, limit: 3 },
    ]);
    expect(upserted[0]!.map((candle) => [candle.openTime, candle.close])).toEqual([
      [0, 202],
      [hourMs, 105],
      [2 * hourMs, 105],
      [4 * hourMs, 105],
    ]);
    expect(result).toMatchObject({
      requestedWindows: 2,
      fetchedCandles: 5,
      sourceTimeframe: "1h",
      sourceCandles: 4,
      generatedCandles: 0,
      normalizedCandles: 4,
      inserted: 4,
      updated: 0,
      gapCount: 1,
      missingSourceCandles: 1,
      scannerEligible: false,
    });
    expect(fetchCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1h" }),
    );
    expect(result.diagnostics?.missingOpenTimes).toEqual([3 * hourMs]);
  });

  it("derives Coinbase 4h candles from 1h provider candles", async () => {
    const fetchedHourly = Array.from({ length: 9 }, (_, index) =>
      makeCandle(index * hourMs, {
        open: 100 + index,
        high: 110 + index,
        low: 90 - index,
        close: 101 + index,
        volume: 10 + index,
      }),
    );
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => {
        expect(request.timeframe).toBe("1h");

        return {
          provider: "ccxt" as const,
          exchange: "coinbase" as const,
          market: "spot",
          rawSymbol: "ABC-USDC",
          providerSymbol: "ABC/USDC",
          timeframe: request.timeframe,
          candles: fetchedHourly,
        };
      },
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "4h",
      targetCandles: 2,
      providerMaxCandlesPerRequest: 16,
      endTimeMs: 15 * hourMs,
    });

    expect(fetchCandles).toHaveBeenCalledTimes(1);
    expect(fetchCandles.mock.calls[0]?.[0]).toMatchObject({
      timeframe: "1h",
      startTime: 0,
      endTime: 15 * hourMs,
      limit: 16,
    });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.timeframe).toBe("4h");
    expect(upserts[0]!.candles).toHaveLength(2);
    expect(upserts[0]!.candles[0]).toMatchObject({
      openTime: 0,
      closeTime: 4 * hourMs - 1,
      open: 100,
      high: 113,
      low: 87,
      close: 104,
      volume: 46,
    });
    expect(upserts[0]!.candles[1]).toMatchObject({
      openTime: 4 * hourMs,
      closeTime: 8 * hourMs - 1,
      open: 104,
      high: 117,
      low: 83,
      close: 108,
      volume: 62,
    });
    expect(result).toMatchObject({
      requestedWindows: 1,
      fetchedCandles: 9,
      sourceTimeframe: "1h",
      sourceCandles: 9,
      generatedCandles: 2,
      normalizedCandles: 2,
      inserted: 2,
      updated: 0,
      gapCount: 0,
      missingSourceCandles: 0,
      firstOpenTime: 0,
      lastOpenTime: 4 * hourMs,
      scannerEligible: false,
    });
    expect(result.fourHourDiagnostics).toMatchObject({
      completeBuckets: 2,
      partialBuckets: 1,
      droppedPartialBuckets: 1,
      gapsDetected: 0,
    });
  });

  it("uses native CCXT 1d for direct daily Coinbase backfill", async () => {
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => ({
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: "ABC-USDC",
        providerSymbol: "ABC/USDC",
        timeframe: request.timeframe,
        candles: [makeDailyCandle(monday), makeDailyCandle(monday + dayMs)],
      }),
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "1d",
      targetCandles: 2,
      providerMaxCandlesPerRequest: 2,
      endTimeMs: monday + dayMs,
    });

    expect(fetchCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1d" }),
    );
    expect(upserts[0]).toMatchObject({
      timeframe: "1d",
      candles: expect.any(Array),
    });
    expect(result).toMatchObject({
      sourceTimeframe: "1d",
      sourceCandles: 2,
      generatedCandles: 0,
      normalizedCandles: 2,
      scannerEligible: false,
    });
  });

  it("derives Coinbase 1w candles from native CCXT 1d provider candles", async () => {
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => {
        expect(request.timeframe).toBe("1d");

        return {
          provider: "ccxt" as const,
          exchange: "coinbase" as const,
          market: "spot",
          rawSymbol: "ABC-USDC",
          providerSymbol: "ABC/USDC",
          timeframe: request.timeframe,
          candles: makeDailyCandles(monday, 7),
        };
      },
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const listCandles = vi.fn(async () => []);
    const store = makeStore({
      listCandles,
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "1w",
      targetCandles: 1,
      providerMaxCandlesPerRequest: 14,
      endTimeMs: monday + 6 * dayMs,
    });

    expect(fetchCandles).toHaveBeenCalledTimes(1);
    expect(fetchCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1d" }),
    );
    expect(listCandles).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.timeframe).toBe("1w");
    expect(upserts[0]!.candles[0]).toMatchObject({
      openTime: monday,
      closeTime: monday + 7 * dayMs - 1,
      open: 100,
      close: 107,
      volume: 91,
    });
    expect(result.weeklyDiagnostics).toMatchObject({
      completeWeeks: 1,
      partialWeeks: 0,
      droppedPartialWeeks: 0,
      gapsDetected: 0,
    });
    expect(result).toMatchObject({
      sourceTimeframe: "1d",
      sourceCandles: 7,
      generatedCandles: 1,
      missingSourceCandles: 0,
      firstOpenTime: monday,
      lastOpenTime: monday,
      scannerEligible: false,
    });
  });

  it("drops incomplete 4h buckets and does not write unsafe generated candles", async () => {
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => ({
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: "ABC-USDC",
        providerSymbol: "ABC/USDC",
        timeframe: request.timeframe,
        candles: [makeCandle(0), makeCandle(hourMs), makeCandle(3 * hourMs)],
      }),
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "4h",
      targetCandles: 1,
      providerMaxCandlesPerRequest: 12,
      endTimeMs: 11 * hourMs,
    });

    expect(fetchCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1h" }),
    );
    expect(upserts[0]).toMatchObject({
      timeframe: "4h",
      candles: [],
    });
    expect(result).toMatchObject({
      sourceTimeframe: "1h",
      sourceCandles: 3,
      generatedCandles: 0,
      normalizedCandles: 0,
      gapCount: 1,
      missingSourceCandles: 1,
      scannerEligible: false,
    });
    expect(result.fourHourDiagnostics).toMatchObject({
      completeBuckets: 0,
      partialBuckets: 1,
      droppedPartialBuckets: 1,
      gapsDetected: 1,
    });
  });

  it("drops incomplete current weeks from CCXT 1d source candles", async () => {
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => ({
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: "ABC-USDC",
        providerSymbol: "ABC/USDC",
        timeframe: request.timeframe,
        candles: [
          ...makeDailyCandles(monday, 7),
          ...makeDailyCandles(monday + 14 * dayMs, 3),
        ],
      }),
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "1w",
      targetCandles: 2,
      providerMaxCandlesPerRequest: 21,
      endTimeMs: monday + 16 * dayMs,
    });

    expect(upserts[0]!.candles).toHaveLength(1);
    expect(upserts[0]!.candles[0]?.openTime).toBe(monday);
    expect(result.weeklyDiagnostics).toMatchObject({
      completeWeeks: 1,
      partialWeeks: 1,
      droppedPartialWeeks: 1,
    });
    expect(result).toMatchObject({
      sourceTimeframe: "1d",
      sourceCandles: 10,
      generatedCandles: 1,
      scannerEligible: false,
    });
  });

  it("drops weeks with missing daily source candles", async () => {
    const missingDaily = makeDailyCandles(monday, 7).filter(
      (candle) => candle.openTime !== monday + 2 * dayMs,
    );
    const fetchCandles = vi.fn(
      async (request: Parameters<MarketDataProvider["fetchCandles"]>[0]) => ({
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: "ABC-USDC",
        providerSymbol: "ABC/USDC",
        timeframe: request.timeframe,
        candles: missingDaily,
      }),
    );
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      upsertCandles: async (input) => {
        upserts.push({ timeframe: input.timeframe, candles: input.candles });
        return { inserted: input.candles.length, updated: 0 };
      },
    });

    const result = await backfillCoinbaseCandlesForSymbol({
      store,
      provider: makeProvider(fetchCandles),
      symbol: coinbaseSymbol(),
      timeframe: "1w",
      targetCandles: 1,
      providerMaxCandlesPerRequest: 14,
      endTimeMs: monday + 6 * dayMs,
    });

    expect(upserts[0]).toMatchObject({
      timeframe: "1w",
      candles: [],
    });
    expect(result.weeklyDiagnostics).toMatchObject({
      completeWeeks: 0,
      partialWeeks: 1,
      droppedPartialWeeks: 1,
      gapsDetected: 1,
    });
    expect(result).toMatchObject({
      sourceTimeframe: "1d",
      sourceCandles: 6,
      generatedCandles: 0,
      missingSourceCandles: 1,
      scannerEligible: false,
    });
  });
});

function makeProvider(fetchCandles: MarketDataProvider["fetchCandles"]): MarketDataProvider {
  return {
    provider: "ccxt",
    listMarkets: async () => [],
    fetchCandles,
  };
}

function makeStore(
  overrides: Partial<CoinbaseBackfillStore> = {},
): CoinbaseBackfillStore {
  return {
    listCandles: async () => [],
    upsertCandles: async (input) => ({ inserted: input.candles.length, updated: 0 }),
    getCandleCoverageForSymbol: async () => ({
      candleCount: 0,
      earliestOpenTimeMs: null,
      latestOpenTimeMs: null,
      latestCloseTimeMs: null,
    }),
    ...overrides,
  };
}

function coinbaseSymbol(): PgSymbol {
  return {
    id: 42,
    exchange: "coinbase",
    market: "spot",
    symbol: "ABC-USDC",
    baseAsset: "ABC",
    quoteAsset: "USDC",
    status: "active",
    quoteVolume: null,
    priceChangePercent: null,
    isEnabled: true,
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
    metadata: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeCandle(openTime: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 10,
    closeTime: openTime + hourMs - 1,
    ...overrides,
  };
}

function makeDailyCandles(startTimeMs: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const openTime = startTimeMs + index * dayMs;

    return makeDailyCandle(openTime, {
      open: 100 + index,
      high: 110 + index,
      low: 90 - index,
      close: 101 + index,
      volume: 10 + index,
    });
  });
}

function makeDailyCandle(openTime: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    open: 100,
    high: 110,
    low: 90,
    close: 101,
    volume: 10,
    closeTime: openTime + dayMs - 1,
    ...overrides,
  };
}
