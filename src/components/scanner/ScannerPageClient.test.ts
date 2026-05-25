import { describe, expect, it } from "vitest";
import { filterAndSortResults, type ScannerFiltersState } from "./ScannerPageClient";
import type {
  MarketPhase,
  ScannerSignal,
  ScannerSignalState,
  ScanResult,
} from "@/lib/scanner/types";

describe("scanner result filtering", () => {
  it("filters by signal before sorting the result set", () => {
    const rows = filterAndSortResults(
      [
        makeResult({
          symbol: "AAAUSDT",
          signalState: "HIGH_RISK",
          phase: "OVEREXTENDED",
          rankScore: 90,
        }),
        makeResult({
          symbol: "BBBUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          rankScore: 50,
        }),
        makeResult({
          symbol: "CCCUSDT",
          signalState: "WATCHLIST",
          phase: "BASE_BUILDING",
          rankScore: 70,
        }),
      ],
      makeFilters({ signal: "WATCHLIST" }),
    );

    expect(rows.map((row) => row.symbol)).toEqual(["CCCUSDT", "BBBUSDT"]);
  });

  it("combines signal, phase, opportunity, and risk filters", () => {
    const rows = filterAndSortResults(
      [
        makeResult({
          symbol: "AAAUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 80,
          riskScore: 20,
        }),
        makeResult({
          symbol: "BBBUSDT",
          signalState: "WATCHLIST",
          phase: "BASE_BUILDING",
          opportunityScore: 80,
          riskScore: 20,
        }),
        makeResult({
          symbol: "CCCUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 60,
          riskScore: 20,
        }),
        makeResult({
          symbol: "DDDUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 80,
          riskScore: 45,
        }),
      ],
      makeFilters({
        signal: "WATCHLIST",
        phase: "SQUEEZE",
        minOpportunityScore: 70,
        maxRiskScore: 30,
      }),
    );

    expect(rows.map((row) => row.symbol)).toEqual(["AAAUSDT"]);
  });
});

function makeFilters(
  overrides: Partial<ScannerFiltersState> = {},
): ScannerFiltersState {
  return {
    timeframe: "4h",
    signal: "ALL",
    phase: "ALL",
    minOpportunityScore: 0,
    maxRiskScore: 100,
    sortBy: "rankScore",
    limit: 50,
    ...overrides,
  };
}

function makeResult({
  symbol,
  signalState,
  phase,
  opportunityScore = 50,
  confirmationScore = 30,
  riskScore = 0,
  rankScore = 50,
}: {
  symbol: string;
  signalState: ScannerSignalState;
  phase: MarketPhase;
  opportunityScore?: number;
  confirmationScore?: number;
  riskScore?: number;
  rankScore?: number;
}): ScanResult {
  return {
    exchange: "binance",
    symbol,
    timeframe: "4h",
    price: 100,
    phase,
    signal: makeSignal(signalState),
    opportunityScore,
    confirmationScore,
    riskScore,
    rankScore,
    rsi14: 55,
    bbWidthPercentile: 20,
    volumeRatio: 1,
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: [],
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
  };
}

function makeSignal(state: ScannerSignalState): ScannerSignal {
  return {
    state,
    label: state,
    summary: state,
  };
}
