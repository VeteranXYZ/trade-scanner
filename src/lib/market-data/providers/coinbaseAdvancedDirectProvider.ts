import type { Candle } from "@/lib/shared/timeframes";
import {
  buildEmptyAuditResult,
  fetchJsonWithAuditTimeout,
  getTimeframeDurationMs,
  normalizeAuditCandles,
  type LiveAuditTimeframe,
  type LiveProviderAuditResult,
  type LiveProviderProbe,
  type LiveProviderProbeRequest,
} from "../liveProviderAudit";

type CoinbaseAdvancedCandle = {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
};

type CoinbaseAdvancedCandlesResponse = {
  candles?: CoinbaseAdvancedCandle[];
};

const coinbaseGranularityByTimeframe = {
  "1h": "ONE_HOUR",
  "4h": "FOUR_HOUR",
  "1d": "ONE_DAY",
} satisfies Partial<Record<LiveAuditTimeframe, string>>;

export function createCoinbaseAdvancedDirectProbe(options: {
  apiBaseUrl?: string;
  bearerToken?: string;
} = {}): LiveProviderProbe {
  return {
    providerId: "coinbase_advanced_direct",
    audit: (request) =>
      auditCoinbaseAdvancedDirect({
        ...request,
        apiBaseUrl: options.apiBaseUrl ?? "https://api.coinbase.com",
        bearerToken: options.bearerToken,
      }),
  };
}

export function mapCoinbaseAdvancedCandleToCandle(
  row: CoinbaseAdvancedCandle,
  timeframe: Exclude<LiveAuditTimeframe, "1w">,
): Candle {
  const openTime = Number(row.start) * 1000;

  return {
    openTime,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    closeTime: openTime + getTimeframeDurationMs(timeframe) - 1,
  };
}

async function auditCoinbaseAdvancedDirect({
  symbol,
  timeframe,
  lookbackDays,
  timeoutMs,
  nowMs,
  fetcher,
  apiBaseUrl,
  bearerToken,
}: LiveProviderProbeRequest & {
  apiBaseUrl: string;
  bearerToken?: string;
}): Promise<LiveProviderAuditResult> {
  if (timeframe === "1w") {
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: false,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "unsupported",
      errorMessage: "Coinbase Advanced direct candles do not expose native 1w granularity.",
      dataUseWarning: "Do not derive weekly candles in the live audit; report unsupported.",
    });
  }

  const url = new URL(
    `/api/v3/brokerage/products/${encodeURIComponent(symbol)}/candles`,
    apiBaseUrl,
  );
  const endSeconds = Math.floor(nowMs / 1000);
  const startSeconds = Math.floor((nowMs - lookbackDays * 24 * 60 * 60 * 1000) / 1000);
  url.searchParams.set("start", String(startSeconds));
  url.searchParams.set("end", String(endSeconds));
  url.searchParams.set("granularity", coinbaseGranularityByTimeframe[timeframe]);
  url.searchParams.set("limit", "350");

  const response = await fetchJsonWithAuditTimeout(
    fetcher,
    url,
    timeoutMs,
    bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
  );

  if (!response.ok) {
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired: response.status === 401 || response.status === 403,
      errorCode: response.status === 401 || response.status === 403 ? "auth_required" : "provider_error",
      errorMessage: `Coinbase Advanced request failed with ${response.status}: ${
        response.text || response.statusText
      }`,
    });
  }

  const body = response.json as CoinbaseAdvancedCandlesResponse | undefined;
  const rows = Array.isArray(body?.candles) ? body.candles : [];
  const candles = rows.map((row) => mapCoinbaseAdvancedCandleToCandle(row, timeframe));
  const diagnostics = normalizeAuditCandles(candles, timeframe);

  return buildEmptyAuditResult({
    providerId: "coinbase_advanced_direct",
    symbolRequested: symbol,
    providerSymbolUsed: symbol,
    exchangeSpecific: true,
    aggregatedOnly: false,
    quoteAssetPreserved: true,
    timeframe,
    nativeIntervalSupported: true,
    fetchedCandles: diagnostics.fetchedCandles,
    firstOpenTime: diagnostics.firstOpenTime,
    lastOpenTime: diagnostics.lastOpenTime,
    enoughForVegaRank200: diagnostics.enoughForVegaRank200,
    gapCount: diagnostics.gapCount,
    requestCount: 1,
    rateLimitObserved: response.rateLimitObserved,
    authRequired: false,
    errorCode: diagnostics.enoughForVegaRank200 ? undefined : "insufficient_history",
    errorMessage: diagnostics.enoughForVegaRank200
      ? undefined
      : `Only ${diagnostics.fetchedCandles} usable Coinbase candles were returned.`,
  });
}
