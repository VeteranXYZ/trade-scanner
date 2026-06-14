import {
  buildEmptyAuditResult,
  type LiveProviderProbe,
} from "../liveProviderAudit";

export function createCryptoDataDownloadProbe(): LiveProviderProbe {
  return {
    providerId: "cryptodatadownload",
    audit: async ({ symbol, timeframe }) =>
      buildEmptyAuditResult({
        providerId: "cryptodatadownload",
        symbolRequested: symbol,
        providerSymbolUsed: symbol,
        exchangeSpecific: "unknown",
        aggregatedOnly: false,
        quoteAssetPreserved: "unknown",
        timeframe,
        nativeIntervalSupported: "unknown",
        fetchedCandles: 0,
        enoughForVegaRank200: false,
        requestCount: 0,
        authRequired: false,
        errorCode: "needs_manual_url_mapping",
        errorMessage:
          "CryptoDataDownload uses downloadable CSV files; safe automated endpoint mapping is not configured in this phase.",
        dataUseWarning:
          "No aggressive HTML scraping is performed. Add explicit CSV URL mappings before automated use.",
      }),
  };
}
