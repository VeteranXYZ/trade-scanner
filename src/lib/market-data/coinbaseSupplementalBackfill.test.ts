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
      normalizedCandles: 4,
      inserted: 4,
      updated: 0,
      gapCount: 1,
    });
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
      normalizedCandles: 2,
      inserted: 2,
      updated: 0,
      gapCount: 0,
    });
    expect(result.fourHourDiagnostics).toMatchObject({
      completeBuckets: 2,
      partialBuckets: 1,
      droppedPartialBuckets: 1,
      gapsDetected: 0,
    });
  });

  it("keeps direct daily Coinbase backfill behavior unchanged", async () => {
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

    await backfillCoinbaseCandlesForSymbol({
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
  });

  it("aggregates weekly candles from stored daily candles without provider fetch", async () => {
    const fetchCandles = vi.fn(async () => {
      throw new Error("provider should not be called for weekly aggregation");
    }) as MarketDataProvider["fetchCandles"];
    const upserts: Array<{ timeframe: string; candles: Candle[] }> = [];
    const store = makeStore({
      listCandles: async () => makeDailyCandles(monday, 7),
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
      providerMaxCandlesPerRequest: 3,
      endTimeMs: monday + 7 * dayMs,
    });

    expect(fetchCandles).not.toHaveBeenCalled();
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
