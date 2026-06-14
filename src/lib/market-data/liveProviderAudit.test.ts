import { describe, expect, it, vi } from "vitest";
import { runLiveAuditCli } from "../../../scripts/audit-live-crypto-ohlcv-providers";
import { providerCapabilityProfilesById } from "./providerCapabilities";
import {
  auditLiveCryptoOhlcvProviders,
  type FetchLike,
  type LiveAuditProviderId,
  type LiveProviderProbe,
} from "./liveProviderAudit";
import { createAuthRequiredProbe } from "./providers/authRequiredProbeProvider";
import {
  createCoinbaseAdvancedDirectProbe,
  mapCoinbaseAdvancedCandleToCandle,
} from "./providers/coinbaseAdvancedDirectProvider";
import { createCoinGeckoProbe } from "./providers/coingeckoProbeProvider";
import { createCryptoDataDownloadProbe } from "./providers/cryptoDataDownloadProbeProvider";

describe("live crypto OHLCV provider audit", () => {
  it("keeps the normalized provider result schema stable", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["cryptodatadownload"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        cryptodatadownload: createCryptoDataDownloadProbe(),
      }),
    });

    expect(Object.keys(report.results[0]!).sort()).toEqual([
      "aggregatedOnly",
      "authRequired",
      "enoughForVegaRank200",
      "errorCode",
      "errorMessage",
      "exchangeSpecific",
      "fetchedCandles",
      "nativeIntervalSupported",
      "providerId",
      "providerSymbolUsed",
      "providerType",
      "quoteAssetPreserved",
      "requestCount",
      "symbolRequested",
      "timeframe",
      "dataUseWarning",
    ].sort());
  });

  it("maps Coinbase Advanced direct candles into VegaRank Candle shape", () => {
    expect(
      mapCoinbaseAdvancedCandleToCandle(
        {
          start: "1700000000",
          low: "90",
          high: "120",
          open: "100",
          close: "110",
          volume: "123.45",
        },
        "4h",
      ),
    ).toEqual({
      openTime: 1_700_000_000_000,
      open: 100,
      high: 120,
      low: 90,
      close: 110,
      volume: 123.45,
      closeTime: 1_700_014_399_999,
    });
  });

  it("reports Coinbase Advanced 1w as unsupported rather than deriving it", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["1w"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe(),
      }),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({
      providerId: "coinbase_advanced_direct",
      timeframe: "1w",
      nativeIntervalSupported: false,
      errorCode: "unsupported",
      fetchedCandles: 0,
    });
  });

  it("does not accept an aggregated provider as exchange-specific primary", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coingecko"],
      symbols: ["BTCUSDT"],
      timeframes: ["4h"],
      lookbackDays: 30,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher([[1_700_000_000_000, 100, 120, 90, 110]]),
      probes: makeProbeRegistry({
        coingecko: createCoinGeckoProbe(),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "coingecko",
      exchangeSpecific: false,
      aggregatedOnly: true,
    });
    expect(report.summary.exchangeSpecificCandidates).not.toContain("coingecko");
    expect(report.summary.aggregatedOnlyCandidates).toContain("coingecko");
  });

  it("reports auth-required providers without throwing", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinapi"],
      symbols: ["BTCUSDT"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        coinapi: createAuthRequiredProbe("coinapi"),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "coinapi",
      authRequired: true,
      errorCode: "paid_or_key_required",
    });
    expect(report.summary.authOrPaidBlockedProviders).toContain("coinapi");
  });

  it("reports missing symbol mapping separately from provider outage", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coingecko"],
      symbols: ["UNKNOWN-USDC"],
      timeframes: ["1d"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coingecko: createCoinGeckoProbe(),
      }),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({
      errorCode: "symbol_mapping_missing",
      requestCount: 0,
    });
    expect(report.summary.providerDecisionNotes).toContain(
      "Some no-result cases are symbol mapping gaps, not proven provider outages.",
    );
  });

  it("can join live audit output with the static provider capability model", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["cryptodatadownload"],
      symbols: ["BTCUSDT"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        cryptodatadownload: createCryptoDataDownloadProbe(),
      }),
    });

    for (const result of report.results) {
      expect(providerCapabilityProfilesById[result.providerId]).toBeDefined();
      expect(result.providerType).toBe(providerCapabilityProfilesById[result.providerId].providerType);
    }
  });

  it("emits parseable CLI JSON output", async () => {
    const messages: unknown[] = [];

    await runLiveAuditCli(
      [
        "--providers=cryptodatadownload",
        "--symbols=BTCUSDT",
        "--timeframes=1h",
        "--json",
      ],
      { log: (message) => messages.push(message) },
    );

    const parsed = JSON.parse(String(messages[0]));
    expect(parsed.results[0]).toMatchObject({
      providerId: "cryptodatadownload",
      errorCode: "needs_manual_url_mapping",
    });
  });

  it("emits CLI markdown with a provider matrix style summary", async () => {
    const messages: unknown[] = [];

    await runLiveAuditCli(
      [
        "--providers=cryptodatadownload",
        "--symbols=BTCUSDT",
        "--timeframes=1h",
        "--markdown",
      ],
      { log: (message) => messages.push(message) },
    );

    const markdown = String(messages[0]);
    expect(markdown).toContain("# Live Crypto OHLCV Provider Audit");
    expect(markdown).toContain("## Provider Matrix");
    expect(markdown).toContain("| providerId | symbol | providerSymbol | timeframe |");
  });
});

function makeProbeRegistry(
  overrides: Partial<Record<LiveAuditProviderId, LiveProviderProbe>>,
): Record<LiveAuditProviderId, LiveProviderProbe> {
  const fallback = createCryptoDataDownloadProbe();

  return {
    coinbase_advanced_direct: fallback,
    cryptocompare: fallback,
    cryptodatadownload: fallback,
    coingecko: fallback,
    coinapi: fallback,
    kaiko: fallback,
    polygon_crypto: fallback,
    tiingo_crypto: fallback,
    ...overrides,
  };
}

function jsonFetcher(body: unknown): FetchLike {
  return async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}
