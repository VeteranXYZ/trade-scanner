import type { Candle, Timeframe } from "@/lib/shared/timeframes";
import type { CandleProviderResult, MarketDataProvider } from "../marketDataProvider";
import {
  parseMarketSymbol,
  type MarketListing,
} from "../symbolIdentity";

export type CcxtOhlcvRow = [
  number | string,
  number | string,
  number | string,
  number | string,
  number | string,
  number | string,
];

export type CcxtMarketLike = {
  id?: string;
  symbol?: string;
  base?: string;
  quote?: string;
  active?: boolean;
  spot?: boolean;
  type?: string;
};

export type CcxtClientLike = {
  markets?: Record<string, CcxtMarketLike> | CcxtMarketLike[];
  timeframes?: Record<string, string> | string[];
  loadMarkets?: () => Promise<Record<string, CcxtMarketLike> | CcxtMarketLike[]>;
  fetchOHLCV: (
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
    params?: Record<string, unknown>,
  ) => Promise<CcxtOhlcvRow[]>;
};

export type FetchCoinbaseCandlesOptions = {
  since?: number;
  limit?: number;
  params?: Record<string, unknown>;
};

const coinbaseExchange = "coinbase" as const;
const coinbaseProvider = "ccxt" as const;
const coinbaseMarket = "spot";
const coinbaseUsdcQuote = "USDC";
const coinbaseSourcePriority = 2;
const supportedCoinbaseTimeframes = ["1h", "4h", "1d"] as const;

type SupportedCoinbaseTimeframe = (typeof supportedCoinbaseTimeframes)[number];

type CcxtModule = {
  coinbase?: new (options?: Record<string, unknown>) => CcxtClientLike;
  default?: {
    coinbase?: new (options?: Record<string, unknown>) => CcxtClientLike;
  };
};

export async function createCcxtCoinbaseClient(
  options: Record<string, unknown> = {},
): Promise<CcxtClientLike> {
  const ccxtModule = (await import("ccxt")) as CcxtModule;
  const CoinbaseClient = ccxtModule.coinbase ?? ccxtModule.default?.coinbase;

  if (!CoinbaseClient) {
    throw new Error("CCXT Coinbase client is unavailable.");
  }

  return new CoinbaseClient({
    enableRateLimit: true,
    ...options,
  });
}

export function createCcxtCoinbaseProvider(client: CcxtClientLike): MarketDataProvider {
  return {
    provider: coinbaseProvider,
    listMarkets: () => listCoinbaseUsdcSpotListings(client),
    fetchCandles: async ({ listing, timeframe, limit, startTime }) =>
      fetchCoinbaseCandles(client, listing, timeframe, {
        since: startTime,
        limit,
      }),
  };
}

export async function listCoinbaseUsdcSpotListings(
  client: CcxtClientLike,
): Promise<MarketListing[]> {
  const markets = await loadCcxtMarkets(client);

  return markets
    .map(mapCcxtMarketToCoinbaseUsdcListing)
    .filter((listing): listing is MarketListing => listing !== null)
    .sort(compareCoinbaseListings);
}

export function mapCcxtMarketToCoinbaseUsdcListing(
  market: CcxtMarketLike,
): MarketListing | null {
  if (!isUsableCoinbaseUsdcSpotMarket(market)) {
    return null;
  }

  try {
    return parseMarketSymbol({
      assetClass: "crypto",
      exchange: coinbaseExchange,
      market: coinbaseMarket,
      rawSymbol: market.id,
      baseAsset: market.base,
      quoteAsset: market.quote,
      provider: coinbaseProvider,
      providerSymbol: market.symbol,
      sourcePriority: coinbaseSourcePriority,
      status: "active",
    });
  } catch {
    return null;
  }
}

export async function fetchCoinbaseCandles(
  client: CcxtClientLike,
  listing: MarketListing,
  timeframe: Timeframe,
  options: FetchCoinbaseCandlesOptions = {},
): Promise<CandleProviderResult> {
  const ccxtTimeframe = resolveCoinbaseTimeframe(client, timeframe);
  const rows = await client.fetchOHLCV(
    listing.providerSymbol,
    ccxtTimeframe,
    options.since,
    options.limit,
    options.params ?? {},
  );

  return {
    provider: coinbaseProvider,
    exchange: coinbaseExchange,
    market: coinbaseMarket,
    rawSymbol: listing.rawSymbol,
    providerSymbol: listing.providerSymbol,
    timeframe,
    candles: mapCcxtOhlcvRowsToCandles(rows, timeframe),
  };
}

export function mapCcxtOhlcvRowsToCandles(
  rows: CcxtOhlcvRow[],
  timeframe: Timeframe,
): Candle[] {
  const durationMs = getSupportedTimeframeDurationMs(timeframe);

  return rows
    .map((row) => mapCcxtOhlcvRowToCandle(row, durationMs))
    .sort((left, right) => left.openTime - right.openTime);
}

function mapCcxtOhlcvRowToCandle(row: CcxtOhlcvRow, durationMs: number): Candle {
  const openTime = toFiniteNumber(row[0], "openTime");

  return {
    openTime,
    open: toFiniteNumber(row[1], "open"),
    high: toFiniteNumber(row[2], "high"),
    low: toFiniteNumber(row[3], "low"),
    close: toFiniteNumber(row[4], "close"),
    volume: toFiniteNumber(row[5], "volume"),
    closeTime: openTime + durationMs - 1,
  };
}

function resolveCoinbaseTimeframe(
  client: CcxtClientLike,
  timeframe: Timeframe,
): SupportedCoinbaseTimeframe {
  if (timeframe === "1w") {
    throw new Error(
      "Coinbase 1w candles are not supported in Phase 32C; weekly aggregation is deferred.",
    );
  }

  if (!isSupportedCoinbaseTimeframe(timeframe)) {
    throw new Error(`Coinbase timeframe ${timeframe} is not supported by this adapter.`);
  }

  if (!client.timeframes) {
    return timeframe;
  }

  const supported = Array.isArray(client.timeframes)
    ? client.timeframes.includes(timeframe)
    : Object.prototype.hasOwnProperty.call(client.timeframes, timeframe);

  if (!supported) {
    throw new Error(`Coinbase CCXT client does not support timeframe ${timeframe}.`);
  }

  return timeframe;
}

function getSupportedTimeframeDurationMs(timeframe: Timeframe) {
  switch (timeframe) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    default:
      resolveCoinbaseTimeframe({ fetchOHLCV: async () => [] }, timeframe);
      throw new Error(`Coinbase timeframe ${timeframe} is not supported by this adapter.`);
  }
}

async function loadCcxtMarkets(client: CcxtClientLike): Promise<CcxtMarketLike[]> {
  const markets = client.loadMarkets ? await client.loadMarkets() : client.markets;

  if (!markets) {
    return [];
  }

  return Array.isArray(markets) ? markets : Object.values(markets);
}

function isUsableCoinbaseUsdcSpotMarket(market: CcxtMarketLike) {
  return (
    typeof market.id === "string" &&
    market.id.trim() !== "" &&
    typeof market.symbol === "string" &&
    market.symbol.trim() !== "" &&
    typeof market.base === "string" &&
    market.base.trim() !== "" &&
    normalizeAsset(market.quote) === coinbaseUsdcQuote &&
    market.active === true &&
    isSpotMarket(market)
  );
}

function isSpotMarket(market: CcxtMarketLike) {
  if (market.spot === false) {
    return false;
  }

  if (typeof market.type === "string" && market.type.toLowerCase() !== coinbaseMarket) {
    return false;
  }

  return market.spot === true || market.type?.toLowerCase() === coinbaseMarket;
}

function compareCoinbaseListings(left: MarketListing, right: MarketListing) {
  return left.rawSymbol.localeCompare(right.rawSymbol);
}

function normalizeAsset(value: string | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function isSupportedCoinbaseTimeframe(
  timeframe: Timeframe,
): timeframe is SupportedCoinbaseTimeframe {
  return supportedCoinbaseTimeframes.includes(timeframe as SupportedCoinbaseTimeframe);
}

function toFiniteNumber(value: number | string, field: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid CCXT OHLCV ${field} value.`);
  }

  return number;
}
