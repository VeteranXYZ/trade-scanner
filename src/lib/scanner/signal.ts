import type { MarketPhase, ScannerSignal } from "./types";

export const scannerSignalOrder = [
  "WATCHLIST",
  "CONFIRMED",
  "TREND_CONTINUATION",
  "HIGH_RISK",
  "WEAK",
  "NEUTRAL",
] as const;

export const scannerSignalLabels: Record<
  (typeof scannerSignalOrder)[number],
  string
> = {
  WATCHLIST: "Watchlist",
  CONFIRMED: "Confirmed",
  TREND_CONTINUATION: "Trend",
  HIGH_RISK: "High Risk",
  WEAK: "Weak",
  NEUTRAL: "Neutral",
};

type SignalInput = {
  phase: MarketPhase;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
};

export function deriveScannerSignal({
  phase,
  opportunityScore,
  confirmationScore,
  riskScore,
}: SignalInput): ScannerSignal {
  if (phase === "BREAKDOWN") {
    return {
      state: "WEAK",
      label: scannerSignalLabels.WEAK,
      summary: "Price and momentum are below key trend levels.",
    };
  }

  if (riskScore >= 55 || phase === "OVEREXTENDED" || phase === "DISTRIBUTION") {
    return {
      state: "HIGH_RISK",
      label: scannerSignalLabels.HIGH_RISK,
      summary: "Risk conditions dominate this setup.",
    };
  }

  if (
    phase === "BREAKOUT_CONFIRMED" &&
    confirmationScore >= 70 &&
    riskScore <= 40
  ) {
    return {
      state: "CONFIRMED",
      label: scannerSignalLabels.CONFIRMED,
      summary: "Breakout has trend, momentum, and volume confirmation.",
    };
  }

  if (
    (phase === "SQUEEZE" || phase === "BASE_BUILDING") &&
    opportunityScore >= 70 &&
    riskScore <= 35
  ) {
    return {
      state: "WATCHLIST",
      label: scannerSignalLabels.WATCHLIST,
      summary: "Compression or base structure is forming, but confirmation is still needed.",
    };
  }

  if (
    (phase === "TRENDING" || phase === "PULLBACK_HEALTHY") &&
    confirmationScore >= 45 &&
    riskScore <= 40
  ) {
    return {
      state: "TREND_CONTINUATION",
      label: scannerSignalLabels.TREND_CONTINUATION,
      summary: "Trend structure remains constructive with manageable risk.",
    };
  }

  return {
    state: "NEUTRAL",
    label: scannerSignalLabels.NEUTRAL,
    summary: "No clear edge from the current scanner rules.",
  };
}
