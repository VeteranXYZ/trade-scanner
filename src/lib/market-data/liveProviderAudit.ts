import type {
  MarketDataProviderId,
  ProviderType,
} from "./providerCapabilities";
import { providerCapabilityProfilesById } from "./providerCapabilities";
import { normalizeCandles } from "./candleQuality";
import type { Candle, Timeframe } from "@/lib/shared/timeframes";

export type LiveAuditTimeframe = "1h" | "4h" | "1d" | "1w";

export type LiveAuditProviderId =
  | "coinbase_advanced_direct"
  | "cryptocompare"
  | "cryptodatadownload"
  | "coingecko"
  | "coinapi"
  | "kaiko"
  | "polygon_crypto"
  | "tiingo_crypto";

export type LiveAuditStatus =
  | "ok"
  | "unsupported"
  | "auth_required"
  | "paid_or_key_required"
  | "limited_test_unavailable"
  | "needs_manual_url_mapping"
  | "symbol_mapping_missing"
  | "provider_error"
  | "insufficient_history";

export type TriState = boolean | "unknown";

export type LiveProviderAuditResult = {
  providerId: MarketDataProviderId;
  providerType: ProviderType;
  symbolRequested: string;
  providerSymbolUsed: string;
  exchangeSpecific: TriState;
  aggregatedOnly: TriState;
  quoteAssetPreserved: TriState;
  timeframe: LiveAuditTimeframe;
  nativeIntervalSupported: TriState;
  fetchedCandles: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  enoughForVegaRank200: boolean;
  gapCount?: number;
  requestCount: number;
  rateLimitObserved?: string;
  authRequired: boolean;
  errorCode?: LiveAuditStatus | string;
  errorMessage?: string;
  dataUseWarning?: string;
};

export type LiveProviderProbeRequest = {
  symbol: string;
  timeframe: LiveAuditTimeframe;
  lookbackDays: number;
  timeoutMs: number;
  verbose: boolean;
  nowMs: number;
  fetcher: FetchLike;
};

export type LiveProviderProbe = {
  providerId: LiveAuditProviderId;
  audit(request: LiveProviderProbeRequest): Promise<LiveProviderAuditResult>;
};

export type LiveProviderAuditOptions = {
  providers: LiveAuditProviderId[];
  symbols: string[];
  timeframes: LiveAuditTimeframe[];
  lookbackDays: number;
  timeoutMs: number;
  verbose?: boolean;
  nowMs?: number;
  fetcher?: FetchLike;
  probes: Record<LiveAuditProviderId, LiveProviderProbe>;
};

export type TimeframeCoverageSummary = Record<
  string,
  Partial<Record<LiveAuditTimeframe, { ok: number; enoughForVegaRank200: number }>>
>;

export type LiveProviderAuditSummary = {
  providersAudited: string[];
  symbolsAudited: string[];
  timeframeCoverageByProvider: TimeframeCoverageSummary;
  exchangeSpecificCandidates: string[];
  aggregatedOnlyCandidates: string[];
  metadataOnlyCandidates: string[];
  native4hCandidates: string[];
  native1wCandidates: string[];
  enoughForVegaRankByProvider: Record<string, number>;
  authOrPaidBlockedProviders: string[];
  recommendedNextProviderTests: string[];
  providerDecisionNotes: string[];
};

export type LiveProviderAuditReport = {
  generatedAt: string;
  liveNetworkRequests: true;
  readOnly: true;
  requiredCandleCount: 200;
  lookbackDays: number;
  results: LiveProviderAuditResult[];
  summary: LiveProviderAuditSummary;
};

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export function buildEmptyAuditResult(
  overrides: Omit<LiveProviderAuditResult, "providerType"> & {
    providerType?: ProviderType;
  },
): LiveProviderAuditResult {
  return {
    providerType: providerCapabilityProfilesById[overrides.providerId]?.providerType ??
      overrides.providerType ??
      "unknown_or_unsuitable",
    ...overrides,
  };
}

export async function auditLiveCryptoOhlcvProviders(
  options: LiveProviderAuditOptions,
): Promise<LiveProviderAuditReport> {
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const nowMs = options.nowMs ?? Date.now();
  const results: LiveProviderAuditResult[] = [];

  for (const providerId of options.providers) {
    const probe = options.probes[providerId];

    for (const symbol of options.symbols) {
      for (const timeframe of options.timeframes) {
        if (!probe) {
          results.push(
            buildEmptyAuditResult({
              providerId,
              symbolRequested: symbol,
              providerSymbolUsed: symbol,
              exchangeSpecific: "unknown",
              aggregatedOnly: "unknown",
              quoteAssetPreserved: "unknown",
              timeframe,
              nativeIntervalSupported: "unknown",
              fetchedCandles: 0,
              enoughForVegaRank200: false,
              requestCount: 0,
              authRequired: false,
              errorCode: "provider_error",
              errorMessage: `No live audit probe is registered for ${providerId}.`,
            }),
          );
          continue;
        }

        results.push(
          await probe.audit({
            symbol,
            timeframe,
            lookbackDays: options.lookbackDays,
            timeoutMs: options.timeoutMs,
            verbose: options.verbose ?? false,
            nowMs,
            fetcher,
          }),
        );
      }
    }
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    liveNetworkRequests: true,
    readOnly: true,
    requiredCandleCount: 200,
    lookbackDays: options.lookbackDays,
    results,
    summary: summarizeLiveProviderAudit(results),
  };
}

export function normalizeAuditCandles(
  candles: Candle[],
  timeframe: LiveAuditTimeframe,
): {
  candles: Candle[];
  fetchedCandles: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  enoughForVegaRank200: boolean;
  gapCount: number;
} {
  const normalized = normalizeCandles(candles, timeframe as Timeframe);

  return {
    candles: normalized.candles,
    fetchedCandles: normalized.candles.length,
    firstOpenTime: normalized.diagnostics.firstOpenTime,
    lastOpenTime: normalized.diagnostics.lastOpenTime,
    enoughForVegaRank200: normalized.candles.length >= 200,
    gapCount: normalized.diagnostics.gapCount,
  };
}

export function getTimeframeDurationMs(timeframe: LiveAuditTimeframe): number {
  switch (timeframe) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export async function fetchJsonWithAuditTimeout(
  fetcher: FetchLike,
  url: URL,
  timeoutMs: number,
  headers: Record<string, string> = {},
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json?: unknown;
  text: string;
  rateLimitObserved?: string;
}> {
  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  const rateLimitObserved =
    response.headers.get("retry-after") ??
    response.headers.get("x-ratelimit-remaining") ??
    undefined;

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json: parseJsonOrUndefined(text),
    text,
    rateLimitObserved,
  };
}

function summarizeLiveProviderAudit(
  results: LiveProviderAuditResult[],
): LiveProviderAuditSummary {
  const providersAudited = unique(results.map((result) => result.providerId));
  const symbolsAudited = unique(results.map((result) => result.symbolRequested));
  const timeframeCoverageByProvider: TimeframeCoverageSummary = {};
  const enoughForVegaRankByProvider: Record<string, number> = {};

  for (const result of results) {
    const providerCoverage = (timeframeCoverageByProvider[result.providerId] ??= {});
    const timeframeCoverage = (providerCoverage[result.timeframe] ??= {
      ok: 0,
      enoughForVegaRank200: 0,
    });

    if (!result.errorCode && result.fetchedCandles > 0) {
      timeframeCoverage.ok += 1;
    }

    if (result.enoughForVegaRank200) {
      timeframeCoverage.enoughForVegaRank200 += 1;
      enoughForVegaRankByProvider[result.providerId] =
        (enoughForVegaRankByProvider[result.providerId] ?? 0) + 1;
    }
  }

  const exchangeSpecificCandidates = providersWith(results, (result) =>
    result.exchangeSpecific === true && result.aggregatedOnly !== true,
  );
  const aggregatedOnlyCandidates = providersWith(
    results,
    (result) => result.aggregatedOnly === true,
  );
  const metadataOnlyCandidates = providersAudited.filter((providerId) => {
    const profile = providerCapabilityProfilesById[providerId as MarketDataProviderId];
    return profile?.providerType === "metadata" || profile?.fitForVegaRank === "metadata_only";
  });
  const native4hCandidates = providersWith(
    results,
    (result) => result.timeframe === "4h" && result.nativeIntervalSupported === true,
  );
  const native1wCandidates = providersWith(
    results,
    (result) => result.timeframe === "1w" && result.nativeIntervalSupported === true,
  );
  const authOrPaidBlockedProviders = providersWith(
    results,
    (result) =>
      result.authRequired ||
      result.errorCode === "auth_required" ||
      result.errorCode === "paid_or_key_required",
  );

  return {
    providersAudited,
    symbolsAudited,
    timeframeCoverageByProvider,
    exchangeSpecificCandidates,
    aggregatedOnlyCandidates,
    metadataOnlyCandidates,
    native4hCandidates,
    native1wCandidates,
    enoughForVegaRankByProvider,
    authOrPaidBlockedProviders,
    recommendedNextProviderTests: buildRecommendedNextProviderTests(results),
    providerDecisionNotes: buildProviderDecisionNotes(results),
  };
}

function buildRecommendedNextProviderTests(results: LiveProviderAuditResult[]): string[] {
  const notes: string[] = [];

  if (
    results.some(
      (result) =>
        result.providerId === "coinbase_advanced_direct" &&
        result.timeframe === "4h" &&
        result.nativeIntervalSupported === true &&
        result.enoughForVegaRank200,
    )
  ) {
    notes.push("Compare Coinbase Advanced direct 4h coverage against current derived 4h baseline.");
  }

  if (results.some((result) => result.providerId === "cryptocompare" && result.authRequired)) {
    notes.push("Decide whether CryptoCompare API-key testing is worth a controlled follow-up.");
  }

  if (results.some((result) => result.providerId === "coingecko")) {
    notes.push("Use CoinGecko only for aggregated context or metadata unless exchange-specific provenance is added.");
  }

  if (results.some((result) => result.providerId === "cryptodatadownload")) {
    notes.push("Map CryptoDataDownload CSV URLs manually before treating it as an automated provider.");
  }

  return notes;
}

function buildProviderDecisionNotes(results: LiveProviderAuditResult[]): string[] {
  const notes = [
    "Do not recommend aggregated coin-level providers as exchange-specific primary sources.",
    "Do not mark any provider production-ready while licensing, auth, or history depth is unknown.",
    "Native interval support is reported separately from derived or provider-aggregated availability.",
  ];

  if (results.some((result) => result.errorCode === "symbol_mapping_missing")) {
    notes.push("Some no-result cases are symbol mapping gaps, not proven provider outages.");
  }

  return notes;
}

function providersWith(
  results: LiveProviderAuditResult[],
  predicate: (result: LiveProviderAuditResult) => boolean,
) {
  return unique(results.filter(predicate).map((result) => result.providerId));
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function parseJsonOrUndefined(text: string) {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(input: string | URL, init?: RequestInit) {
  return fetch(input, init);
}
