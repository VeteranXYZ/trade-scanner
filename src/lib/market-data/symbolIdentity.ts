import type { DataProvider, Exchange, Market } from "@/lib/shared/timeframes";

export type AssetClass = "crypto" | "equity" | "etf" | "fx" | "macro";

export type MarketListing = {
  assetClass: AssetClass;
  exchange: Exchange;
  market: string;
  rawSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  provider: DataProvider;
  providerSymbol: string;
  canonicalAssetKey: string;
  sourcePriority: number;
  quoteVolume?: number;
  priceChangePercent?: number;
  status?: string;
};

export type ParseMarketSymbolInput = {
  assetClass?: AssetClass;
  exchange: Exchange;
  market?: string;
  rawSymbol?: string;
  symbol?: string;
  baseAsset?: string;
  quoteAsset?: string;
  provider?: DataProvider;
  providerSymbol?: string;
  sourcePriority?: number;
  quoteVolume?: number;
  priceChangePercent?: number;
  status?: string;
};

type ParsedSymbolParts = {
  baseAsset: string;
  quoteAsset: string;
};

export function parseMarketSymbol(input: ParseMarketSymbolInput): MarketListing {
  const rawSymbol = normalizeSymbol(input.rawSymbol ?? input.symbol ?? "");
  const explicitBase = normalizeAssetCode(input.baseAsset ?? "");
  const explicitQuote = normalizeAssetCode(input.quoteAsset ?? "");

  if (!rawSymbol) {
    throw new Error("Market listing rawSymbol is required.");
  }

  const parsed =
    explicitBase && explicitQuote
      ? validateExplicitParts({ input, rawSymbol, baseAsset: explicitBase, quoteAsset: explicitQuote })
      : parseRawSymbolByExchange(input.exchange, rawSymbol);
  const canonicalAssetKey = getCanonicalAssetKey(parsed);

  return {
    assetClass: input.assetClass ?? "crypto",
    exchange: input.exchange,
    market: normalizeMarket(input.market),
    rawSymbol,
    baseAsset: parsed.baseAsset,
    quoteAsset: parsed.quoteAsset,
    provider: input.provider ?? defaultProviderForExchange(input.exchange),
    providerSymbol: normalizeSymbol(input.providerSymbol ?? rawSymbol),
    canonicalAssetKey,
    sourcePriority: input.sourcePriority ?? defaultSourcePriority(input.exchange),
    quoteVolume: input.quoteVolume,
    priceChangePercent: input.priceChangePercent,
    status: input.status,
  };
}

export function marketToListing(
  market: Market,
  options: {
    assetClass?: AssetClass;
    provider?: DataProvider;
    providerSymbol?: string;
    sourcePriority?: number;
  } = {},
): MarketListing {
  return parseMarketSymbol({
    assetClass: options.assetClass,
    exchange: market.exchange,
    market: "spot",
    rawSymbol: market.symbol,
    baseAsset: market.baseAsset,
    quoteAsset: market.quoteAsset,
    provider: options.provider,
    providerSymbol: options.providerSymbol,
    sourcePriority: options.sourcePriority,
    quoteVolume: market.quoteVolume,
    priceChangePercent: market.priceChangePercent,
    status: market.status,
  });
}

export function getCanonicalAssetKey(input: { baseAsset: string } | string) {
  const baseAsset = typeof input === "string" ? input : input.baseAsset;
  const normalizedBaseAsset = normalizeAssetCode(baseAsset);

  if (!isSupportedAssetCode(normalizedBaseAsset)) {
    throw new Error(`Invalid base asset for canonical asset key: ${baseAsset}`);
  }

  return normalizedBaseAsset;
}

export function getMarketDedupKey(input: { baseAsset: string } | string) {
  return getCanonicalAssetKey(input);
}

export function buildListingId(
  input:
    | MarketListing
    | Pick<MarketListing, "assetClass" | "exchange" | "market" | "rawSymbol">,
) {
  return [
    input.assetClass,
    input.exchange.toLowerCase(),
    input.market.toLowerCase(),
    normalizeSymbol(input.rawSymbol),
  ].join(":");
}

function validateExplicitParts({
  input,
  rawSymbol,
  baseAsset,
  quoteAsset,
}: {
  input: ParseMarketSymbolInput;
  rawSymbol: string;
  baseAsset: string;
  quoteAsset: string;
}): ParsedSymbolParts {
  if (!isSupportedAssetCode(baseAsset) || !isSupportedAssetCode(quoteAsset)) {
    throw new Error(`Invalid market asset pair for ${rawSymbol}.`);
  }

  const parsed = parseRawSymbolByExchange(input.exchange, rawSymbol);

  if (parsed.baseAsset !== baseAsset || parsed.quoteAsset !== quoteAsset) {
    throw new Error(
      `Market asset pair does not match ${input.exchange} symbol ${rawSymbol}.`,
    );
  }

  return { baseAsset, quoteAsset };
}

function parseRawSymbolByExchange(exchange: Exchange, rawSymbol: string): ParsedSymbolParts {
  switch (exchange) {
    case "binance":
      return parseBinanceSymbol(rawSymbol);
    case "coinbase":
      return parseCoinbaseSymbol(rawSymbol);
  }
}

function parseBinanceSymbol(rawSymbol: string): ParsedSymbolParts {
  const match = /^([A-Z0-9]+)(USDT)$/.exec(rawSymbol);

  if (!match || !match[1]) {
    throw new Error(`Unsupported Binance spot symbol: ${rawSymbol}`);
  }

  return {
    baseAsset: match[1],
    quoteAsset: match[2],
  };
}

function parseCoinbaseSymbol(rawSymbol: string): ParsedSymbolParts {
  const match = /^([A-Z0-9]+)-([A-Z0-9]+)$/.exec(rawSymbol);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Unsupported Coinbase spot symbol: ${rawSymbol}`);
  }

  return {
    baseAsset: match[1],
    quoteAsset: match[2],
  };
}

function defaultProviderForExchange(exchange: Exchange): DataProvider {
  return exchange === "binance" ? "native-binance" : "ccxt";
}

function defaultSourcePriority(exchange: Exchange) {
  return exchange === "binance" ? 1 : 2;
}

function normalizeMarket(value: string | undefined) {
  return value?.trim().toLowerCase() || "spot";
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeAssetCode(value: string) {
  return value.trim().toUpperCase();
}

function isSupportedAssetCode(value: string) {
  return /^[A-Z0-9]+$/.test(value);
}
