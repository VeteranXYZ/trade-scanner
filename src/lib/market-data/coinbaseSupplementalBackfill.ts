import type { Candle, Timeframe } from "@/lib/shared/timeframes";
import type {
  CandleProviderResult,
  MarketDataProvider,
} from "./marketDataProvider";
import { buildBackfillPlan, type BackfillPlan } from "./candleBackfillPlanner";
import {
  normalizeCandles,
  type CandleContinuityDiagnostics,
} from "./candleQuality";
import {
  aggregateDailyCandlesToWeekly,
  type WeeklyAggregationDiagnostics,
} from "./weeklyAggregation";
import {
  aggregateHourlyCandlesToFourHour,
  type FourHourAggregationDiagnostics,
} from "./intradayAggregation";
import { parseMarketSymbol, type MarketListing } from "./symbolIdentity";
import type {
  CandleUpsertStats,
  MarketDataTimeframe,
  PgSymbol,
  SymbolCandleCoverage,
} from "@/lib/storage/postgres/marketDataPg";

export type CoinbaseBackfillTimeframe = "1h" | "4h" | "1d" | "1w";

export type CoinbaseBackfillStore = {
  listCandles(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
    limit: number;
  }): Promise<Candle[]>;
  upsertCandles(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: MarketDataTimeframe;
    candles: Candle[];
  }): Promise<CandleUpsertStats>;
  getCandleCoverageForSymbol(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
  }): Promise<SymbolCandleCoverage>;
};

export type CoinbaseSymbolBackfillResult = {
  symbol: string;
  timeframe: CoinbaseBackfillTimeframe;
  sourceTimeframe?: CoinbaseBackfillTimeframe;
  requestedWindows: number;
  fetchedCandles: number;
  sourceCandles: number;
  generatedCandles: number;
  normalizedCandles: number;
  inserted: number;
  updated: number;
  gapCount: number;
  missingSourceCandles: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  scannerEligible: boolean;
  coverageBefore: SymbolCandleCoverage;
  coverageAfter: SymbolCandleCoverage;
  diagnostics?: CandleContinuityDiagnostics;
  fourHourDiagnostics?: FourHourAggregationDiagnostics;
  weeklyDiagnostics?: WeeklyAggregationDiagnostics;
  plan?: BackfillPlan;
};

const coinbaseExchange = "coinbase";
const spotMarket = "spot";
const directCoinbaseTimeframes = new Set<Timeframe>(["1h", "1d"]);
const fourHourSourceSafetyCandles = 8;
const weeklySourceSafetyCandles = 7;
const scannerMinimumCandles = 200;

export async function backfillCoinbaseCandlesForSymbol({
  store,
  provider,
  symbol,
  timeframe,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  timeframe: CoinbaseBackfillTimeframe;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  if (timeframe === "1w") {
    return backfillCoinbaseWeeklyCandlesFromDailyProvider({
      store,
      provider,
      symbol,
      targetCandles,
      providerMaxCandlesPerRequest,
      endTimeMs,
    });
  }

  if (timeframe === "4h") {
    return backfillCoinbaseFourHourCandlesFromHourly({
      store,
      provider,
      symbol,
      targetCandles,
      providerMaxCandlesPerRequest,
      endTimeMs,
    });
  }

  if (!directCoinbaseTimeframes.has(timeframe)) {
    throw new Error(`Unsupported Coinbase backfill timeframe: ${timeframe}.`);
  }

  return backfillCoinbaseDirectCandles({
    store,
    provider,
    symbol,
    timeframe,
    targetCandles,
    providerMaxCandlesPerRequest,
    endTimeMs,
  });
}

export async function backfillCoinbaseDirectCandles({
  store,
  provider,
  symbol,
  timeframe,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  timeframe: Exclude<CoinbaseBackfillTimeframe, "4h" | "1w">;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  const coverageBefore = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
  });
  const listing = pgSymbolToCoinbaseListing(symbol);
  const plan = buildBackfillPlan({
    timeframe,
    targetCandles,
    maxCandlesPerRequest: providerMaxCandlesPerRequest,
    endTimeMs,
  });
  const fetchedCandles: Candle[] = [];

  for (const window of plan.windows) {
    const result = await provider.fetchCandles({
      listing,
      timeframe,
      startTime: window.startTimeMs,
      endTime: window.endTimeMs,
      limit: window.requestLimit,
    });

    fetchedCandles.push(...filterCandlesToWindow(result, window));
  }

  const normalized = normalizeCandles(fetchedCandles, timeframe);
  const stats = await store.upsertCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
    candles: normalized.candles,
  });
  const coverageAfter = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
  });

  return {
    symbol: symbol.symbol,
    timeframe,
    sourceTimeframe: timeframe,
    requestedWindows: plan.windows.length,
    fetchedCandles: fetchedCandles.length,
    sourceCandles: normalized.candles.length,
    generatedCandles: 0,
    normalizedCandles: normalized.candles.length,
    inserted: stats.inserted,
    updated: stats.updated,
    gapCount: normalized.diagnostics.gapCount,
    missingSourceCandles: normalized.diagnostics.missingOpenTimes.length,
    firstOpenTime: normalized.diagnostics.firstOpenTime,
    lastOpenTime: normalized.diagnostics.lastOpenTime,
    scannerEligible: normalized.candles.length >= scannerMinimumCandles,
    coverageBefore,
    coverageAfter,
    diagnostics: normalized.diagnostics,
    plan,
  };
}

export async function backfillCoinbaseFourHourCandlesFromHourly({
  store,
  provider,
  symbol,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  const coverageBefore = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "4h",
  });
  const listing = pgSymbolToCoinbaseListing(symbol);
  const plan = buildBackfillPlan({
    timeframe: "1h",
    targetCandles: targetCandles * 4 + fourHourSourceSafetyCandles,
    maxCandlesPerRequest: providerMaxCandlesPerRequest,
    endTimeMs,
  });
  const fetchedCandles: Candle[] = [];

  for (const window of plan.windows) {
    const result = await provider.fetchCandles({
      listing,
      timeframe: "1h",
      startTime: window.startTimeMs,
      endTime: window.endTimeMs,
      limit: window.requestLimit,
    });

    fetchedCandles.push(...filterCandlesToWindow(result, window));
  }

  const normalizedHourly = normalizeCandles(fetchedCandles, "1h");
  const aggregated = aggregateHourlyCandlesToFourHour(normalizedHourly.candles);
  const fourHourCandles = aggregated.fourHourCandles.slice(-targetCandles);
  const firstOpenTime = fourHourCandles.at(0)?.openTime;
  const lastOpenTime = fourHourCandles.at(-1)?.openTime;
  const stats = await store.upsertCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "4h",
    candles: fourHourCandles,
  });
  const coverageAfter = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "4h",
  });

  return {
    symbol: symbol.symbol,
    timeframe: "4h",
    sourceTimeframe: "1h",
    requestedWindows: plan.windows.length,
    fetchedCandles: fetchedCandles.length,
    sourceCandles: normalizedHourly.candles.length,
    generatedCandles: fourHourCandles.length,
    normalizedCandles: fourHourCandles.length,
    inserted: stats.inserted,
    updated: stats.updated,
    gapCount: aggregated.diagnostics.gapsDetected,
    missingSourceCandles: normalizedHourly.diagnostics.missingOpenTimes.length,
    firstOpenTime,
    lastOpenTime,
    scannerEligible: fourHourCandles.length >= scannerMinimumCandles,
    coverageBefore,
    coverageAfter,
    diagnostics: normalizedHourly.diagnostics,
    fourHourDiagnostics: aggregated.diagnostics,
    plan,
  };
}

export async function backfillCoinbaseWeeklyCandlesFromDailyProvider({
  store,
  provider,
  symbol,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  const coverageBefore = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
  });
  const listing = pgSymbolToCoinbaseListing(symbol);
  const plan = buildBackfillPlan({
    timeframe: "1d",
    targetCandles: targetCandles * 7 + weeklySourceSafetyCandles,
    maxCandlesPerRequest: providerMaxCandlesPerRequest,
    endTimeMs,
  });
  const fetchedCandles: Candle[] = [];

  for (const window of plan.windows) {
    const result = await provider.fetchCandles({
      listing,
      timeframe: "1d",
      startTime: window.startTimeMs,
      endTime: window.endTimeMs,
      limit: window.requestLimit,
    });

    fetchedCandles.push(...filterCandlesToWindow(result, window));
  }

  const normalizedDaily = normalizeCandles(fetchedCandles, "1d");
  const aggregated = aggregateDailyCandlesToWeekly(normalizedDaily.candles);
  const weeklyCandles = aggregated.weeklyCandles.slice(-targetCandles);
  const firstOpenTime = weeklyCandles.at(0)?.openTime;
  const lastOpenTime = weeklyCandles.at(-1)?.openTime;
  const stats = await store.upsertCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
    candles: weeklyCandles,
  });
  const coverageAfter = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
  });

  return {
    symbol: symbol.symbol,
    timeframe: "1w",
    sourceTimeframe: "1d",
    requestedWindows: plan.windows.length,
    fetchedCandles: fetchedCandles.length,
    sourceCandles: normalizedDaily.candles.length,
    generatedCandles: weeklyCandles.length,
    normalizedCandles: weeklyCandles.length,
    inserted: stats.inserted,
    updated: stats.updated,
    gapCount: aggregated.diagnostics.gapsDetected,
    missingSourceCandles: normalizedDaily.diagnostics.missingOpenTimes.length,
    firstOpenTime,
    lastOpenTime,
    scannerEligible: weeklyCandles.length >= scannerMinimumCandles,
    coverageBefore,
    coverageAfter,
    weeklyDiagnostics: aggregated.diagnostics,
    diagnostics: normalizedDaily.diagnostics,
    plan,
  };
}

export function pgSymbolToCoinbaseListing(symbol: PgSymbol): MarketListing {
  if (symbol.exchange !== coinbaseExchange || symbol.market !== spotMarket) {
    throw new Error(`Expected Coinbase spot symbol, received ${symbol.exchange}:${symbol.symbol}.`);
  }

  return parseMarketSymbol({
    assetClass: "crypto",
    exchange: "coinbase",
    market: "spot",
    rawSymbol: symbol.symbol,
    baseAsset: symbol.baseAsset,
    quoteAsset: symbol.quoteAsset,
    provider: "ccxt",
    providerSymbol: `${symbol.baseAsset}/${symbol.quoteAsset}`,
    sourcePriority: 2,
    quoteVolume: symbol.quoteVolume ?? undefined,
    priceChangePercent: symbol.priceChangePercent ?? undefined,
    status: symbol.status,
  });
}

function filterCandlesToWindow(
  result: CandleProviderResult,
  window: { startTimeMs: number; endTimeMs: number },
) {
  return result.candles.filter(
    (candle) =>
      candle.openTime >= window.startTimeMs && candle.openTime <= window.endTimeMs,
  );
}
