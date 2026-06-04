import type { MarketContextResponse } from "@/components/market-context/marketContextUi";
import {
  MTF_SCREENER_TIMEFRAMES,
  type MtfLatestScreenerResponse,
} from "@/components/screener/multiTimeframeScreenerUi";
import { buildMtfScreenerPreviewResponse } from "@/components/screener/multiTimeframeScreenerPreviewData";

export type WatchlistVisualCheckData = {
  selectedSymbols: string[];
  latestData: MtfLatestScreenerResponse;
  marketContextData: MarketContextResponse;
};

export const watchlistVisualCheckSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "AAVEUSDT",
  "SEIUSDT",
  "SUIUSDT",
  "AVAXUSDT",
  "MISSINGUSDT",
] as const;

export function buildWatchlistVisualCheckData(): WatchlistVisualCheckData {
  const previewData = buildMtfScreenerPreviewResponse();
  const selectedSet = new Set(watchlistVisualCheckSymbols);
  const rows = previewData.rows.filter((row) =>
    selectedSet.has(row.symbol as (typeof watchlistVisualCheckSymbols)[number]),
  );
  const signalCounts = Object.fromEntries(
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => [
      timeframe,
      rows.filter((row) => row.timeframes[timeframe]).length,
    ]),
  ) as MtfLatestScreenerResponse["signalCounts"];
  const missingCounts = Object.fromEntries(
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => [
      timeframe,
      watchlistVisualCheckSymbols.length - signalCounts[timeframe],
    ]),
  ) as MtfLatestScreenerResponse["missingCounts"];
  const runs = Object.fromEntries(
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
      const run = previewData.runs[timeframe];

      return [
        timeframe,
        run
          ? {
              ...run,
              symbolsTotal: watchlistVisualCheckSymbols.length,
              symbolsScanned: watchlistVisualCheckSymbols.length,
              signalsCreated: signalCounts[timeframe],
              symbolsSkipped: missingCounts[timeframe],
            }
          : null,
      ];
    }),
  ) as MtfLatestScreenerResponse["runs"];

  return {
    selectedSymbols: [...watchlistVisualCheckSymbols],
    latestData: {
      ...previewData,
      rows,
      runs,
      signalCounts,
      missingCounts,
      count: rows.length,
    },
    marketContextData: buildWatchlistVisualCheckMarketContext(),
  };
}

function buildWatchlistVisualCheckMarketContext(): MarketContextResponse {
  return {
    ok: true,
    assetClass: "crypto",
    generatedAt: "2026-06-03T16:00:00.000Z",
    context: {
      structuralContext: "long_term_mixed",
      marketContext: "market_mixed",
      tacticalContext: "short_term_repair",
      combinedContext: "mixed_transition",
      confidence: "medium",
    },
    summary: {
      title: "Mixed backdrop with short-term repair",
      description:
        "BTC and ETH context is mixed, so symbol-level watchlist rows remain the primary review surface.",
      researchPosture: "Selective watchlist review",
      keyPoints: [
        "Short-term repair exists, but higher-timeframe risk remains relevant.",
        "Use risk-first symbols and data gaps as the first review pass.",
      ],
      warnings: [],
    },
    rules: {
      researchOnly: true,
    },
  };
}
