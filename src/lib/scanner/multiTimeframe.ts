import type { Timeframe } from "@/lib/exchanges/types";
import type { ScanResult, ScannerSignalState } from "./types";

export type MultiTimeframeAlignment =
  | "STRONG_ALIGNMENT"
  | "EARLY_4H_SIGNAL"
  | "DAILY_CONFIRMATION"
  | "CONFLICTING"
  | "HIGH_RISK";

export type MultiTimeframeSummary = {
  alignment: MultiTimeframeAlignment;
  label: string;
  summary: string;
  constructiveCount: number;
  riskCount: number;
};

const constructiveSignals = new Set<ScannerSignalState>([
  "WATCHLIST",
  "CONFIRMED",
  "TREND_CONTINUATION",
]);
const riskSignals = new Set<ScannerSignalState>(["HIGH_RISK", "WEAK"]);
const higherTimeframes = new Set<Timeframe>(["1d", "7d", "1m"]);

export function summarizeMultiTimeframe(
  results: ScanResult[],
): MultiTimeframeSummary {
  const constructiveCount = results.filter((result) =>
    isConstructive(result.signal.state),
  ).length;
  const riskCount = results.filter((result) => isRisk(result.signal.state)).length;
  const byTimeframe = new Map(results.map((result) => [result.timeframe, result]));
  const oneHour = byTimeframe.get("1h");
  const fourHour = byTimeframe.get("4h");
  const daily = byTimeframe.get("1d");
  const higherRiskCount = results.filter(
    (result) =>
      higherTimeframes.has(result.timeframe) && isRisk(result.signal.state),
  ).length;
  const shortTermConstructive = [oneHour, fourHour].some(
    (result) => result && isConstructive(result.signal.state),
  );
  const coreConstructive =
    Boolean(fourHour && isConstructive(fourHour.signal.state)) &&
    Boolean(daily && isConstructive(daily.signal.state));

  if (riskCount >= 3 || higherRiskCount >= 2) {
    return {
      alignment: "HIGH_RISK",
      label: "High Risk",
      summary: "Multiple timeframes are weak or risk-heavy.",
      constructiveCount,
      riskCount,
    };
  }

  if (coreConstructive && higherRiskCount === 0) {
    return {
      alignment: "STRONG_ALIGNMENT",
      label: "Strong Alignment",
      summary: "4H and 1D structure are constructive without higher-timeframe risk.",
      constructiveCount,
      riskCount,
    };
  }

  if (shortTermConstructive && (!daily || !isRisk(daily.signal.state))) {
    return {
      alignment: "EARLY_4H_SIGNAL",
      label: "Early Signal",
      summary: "Shorter timeframes are improving before full daily confirmation.",
      constructiveCount,
      riskCount,
    };
  }

  if (daily && isConstructive(daily.signal.state)) {
    return {
      alignment: "DAILY_CONFIRMATION",
      label: "Daily Confirmed",
      summary: "Daily structure is constructive, but lower timeframes are mixed.",
      constructiveCount,
      riskCount,
    };
  }

  return {
    alignment: "CONFLICTING",
    label: "Mixed",
    summary: "Timeframes are not aligned enough for a clear structure read.",
    constructiveCount,
    riskCount,
  };
}

function isConstructive(signal: ScannerSignalState) {
  return constructiveSignals.has(signal);
}

function isRisk(signal: ScannerSignalState) {
  return riskSignals.has(signal);
}
