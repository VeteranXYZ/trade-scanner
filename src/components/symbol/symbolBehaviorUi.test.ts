import { describe, expect, it } from "vitest";
import {
  buildBehaviorReadout,
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  getBehaviorGroupLabel,
  getBehaviorHorizonRows,
  getBehaviorSignalLabel,
  getBehaviorUnavailableMessage,
  getHiddenRecentOutcomeCount,
  selectCompactRecentOutcomes,
  type SymbolBehavior,
  type SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";

describe("symbol behavior UI helpers", () => {
  it("formats percentages and sample sizes conservatively", () => {
    expect(formatBehaviorPercent(1.234)).toBe("+1.23%");
    expect(formatBehaviorPercent("2.5")).toBe("+2.50%");
    expect(formatBehaviorPercent(-0.5)).toBe("-0.50%");
    expect(formatBehaviorPercent(0)).toBe("0.00%");
    expect(formatBehaviorPercent(null)).toBe("—");
    expect(formatBehaviorPercent("bad")).toBe("—");
    expect(formatBehaviorWinRate(62.345)).toBe("62.3%");
    expect(formatBehaviorWinRate(null)).toBe("—");
    expect(formatBehaviorSampleSize(12.9)).toBe("12");
    expect(formatBehaviorSampleSize("9")).toBe("9");
    expect(formatBehaviorSampleSize(null)).toBe("0");
  });

  it("formats group and signal labels", () => {
    expect(getBehaviorGroupLabel("insufficient_history")).toBe(
      "Insufficient History",
    );
    expect(getBehaviorSignalLabel("breakdown_risk")).toBe("Breakdown Risk");
    expect(getBehaviorGroupLabel(null)).toBe("Unknown");
  });

  it("selects compact and expanded recent outcomes", () => {
    const outcomes = Array.from({ length: 12 }, (_, index) =>
      makeOutcome(`2026-06-0${index + 1}T00:00:00.000Z`),
    );

    expect(selectCompactRecentOutcomes(outcomes, false)).toHaveLength(10);
    expect(selectCompactRecentOutcomes(outcomes, true)).toHaveLength(12);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: false, compactLimit: 5 }),
    ).toBe(7);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: true, compactLimit: 5 }),
    ).toBe(0);
  });

  it("builds horizon and summary rows from behavior", () => {
    expect(getBehaviorHorizonRows(makeBehavior()).map((row) => row.label)).toEqual([
      "1 candle",
      "3 candles",
      "5 candles",
    ]);
    expect(buildBehaviorSummary(makeBehavior())).toEqual([
      { label: "Sample Size", value: "12 prior observations" },
      { label: "1 Candle Outcomes", value: "11" },
      { label: "3 Candle Outcomes", value: "10" },
      { label: "5 Candle Outcomes", value: "9" },
    ]);
  });

  it("normalizes missing or array-based horizons without crashing", () => {
    expect(getBehaviorHorizonRows({ sampleSize: 3, horizons: null })).toEqual([
      expect.objectContaining({ horizon: "1", sampleSize: 0 }),
      expect.objectContaining({ horizon: "3", sampleSize: 0 }),
      expect.objectContaining({ horizon: "5", sampleSize: 0 }),
    ]);
    expect(
      getBehaviorHorizonRows({
        sampleSize: "3",
        horizons: [{ candles: 1, sampleSize: "2", avgReturnPct: "1.5" }],
      })[0],
    ).toMatchObject({
      horizon: "1",
      sampleSize: 2,
      avgReturnPct: 1.5,
    });
  });

  it("formats unavailable diagnostics messages", () => {
    expect(
      getBehaviorUnavailableMessage({
        diagnostics: {
          available: false,
          reason: "no_prior_signals",
          message: "No prior signals.",
        },
      }),
    ).toContain("No prior matching signals were found yet");
    expect(
      getBehaviorUnavailableMessage({
        diagnostics: { available: false, reason: "no_latest_signal" },
        coverage: { candleCount: "146", requiredCandles: 200 },
      }),
    ).toContain("Current coverage: 146 / 200 required candles.");
    expect(getBehaviorUnavailableMessage()).toBe(
      "Historical behavior is currently unavailable for this symbol/timeframe.",
    );
  });

  it("labels behavior readout sample confidence by selected horizon sample", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(9, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Very limited");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(10, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Limited");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(20, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Moderate");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(50, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Better");
  });

  it("prefers 5, then 3, then 1 candle horizons when usable", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(20, 1.5),
            "5": makeHorizon(20, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("5");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(20, 1.5),
            "5": makeHorizon(9, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("3");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(9, 1.5),
            "5": makeHorizon(9, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("1");
  });

  it("returns insufficient when no horizon has enough usable observations", () => {
    const readout = buildBehaviorReadout(
      makeReadoutInput({
        horizons: {
          "1": makeHorizon(9, 1.2),
          "3": makeHorizon(8, 1.4),
          "5": makeHorizon(7, 1.6),
        },
      }),
    );

    expect(readout.label).toBe("Insufficient sample");
    expect(readout.selectedHorizon).toBeNull();
    expect(readout.horizonAgreement).toBe("insufficient");
  });

  it("classifies horizon agreement as aligned positive, aligned negative, or mixed", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.2, 51),
            "3": makeHorizon(20, 0.3, 55),
            "5": makeHorizon(20, 0.4, 60),
          },
        }),
      ).horizonAgreement,
    ).toBe("aligned_positive");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, -0.2, 44),
            "3": makeHorizon(20, -0.3, 40),
            "5": makeHorizon(20, -0.4, 35),
          },
        }),
      ).horizonAgreement,
    ).toBe("aligned_negative");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.2, 51),
            "3": makeHorizon(20, -0.3, 40),
            "5": makeHorizon(20, 0, 48),
          },
        }),
      ).horizonAgreement,
    ).toBe("mixed");
  });

  it("interprets opportunity context as constructive or weak follow-through", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "eligible",
          horizons: { "5": makeHorizon(20, 1.2, 62) },
        }),
      ).label,
    ).toBe("Strong constructive tendency");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "watch",
          horizons: { "5": makeHorizon(12, -0.4, 42) },
        }),
      ).label,
    ).toBe("Weak follow-through");
  });

  it("interprets risk context as downside continuation or not confirmed", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "risk",
          horizons: { "5": makeHorizon(12, -0.8, 35) },
        }),
      ).label,
    ).toBe("Downside continuation tendency");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "risk",
          horizons: { "5": makeHorizon(12, 0.1, 52) },
        }),
      ).label,
    ).toBe("Risk not confirmed in sample");
  });

  it("handles malformed numeric values without inventing a readout", () => {
    const readout = buildBehaviorReadout(
      makeReadoutInput({
        sampleSize: "bad",
        horizons: {
          "5": {
            sampleSize: "12",
            medianReturnPct: "bad",
            winRatePct: "bad",
          },
        },
      }),
    );

    expect(readout.label).toBe("Insufficient sample");
    expect(readout.historicalBiasLabel).toBe("Not enough usable horizon data");
  });
});

function makeBehavior(): SymbolBehavior {
  return {
    sampleSize: 12,
    horizons: {
      "1": makeHorizon(11, 1.2),
      "3": makeHorizon(10, 2.2),
      "5": makeHorizon(9, 3.2),
    },
    byResultGroup: [],
    bySignalLabel: [],
    recentOutcomes: [],
    currentContext: {
      signalLabel: "confirmed",
      resultGroup: "eligible",
      primaryStructure: "strong_trend",
      timeframe: "4h",
    },
    warnings: [],
  };
}

function makeHorizon(
  sampleSize: number,
  avgReturnPct: number,
  winRatePct = 60,
) {
  return {
    sampleSize,
    avgReturnPct,
    medianReturnPct: avgReturnPct,
    winRatePct,
    bestReturnPct: 5,
    worstReturnPct: -2,
  };
}

function makeReadoutInput(
  overrides: Partial<SymbolBehavior> & {
    resultGroup?: string | null;
    currentGroup?: string | null;
    signalLabel?: string | null;
  } = {},
) {
  return {
    resultGroup: "eligible",
    signalLabel: "confirmed",
    sampleSize: 30,
    horizons: {
      "1": makeHorizon(20, 0.5),
      "3": makeHorizon(20, 1),
      "5": makeHorizon(20, 1.5),
    },
    warnings: [],
    ...overrides,
  };
}

function makeOutcome(scanTime: string): SymbolBehaviorRecentOutcome {
  return {
    scanTime,
    signalLabel: "confirmed",
    resultGroup: "eligible",
    priceAtSignal: 1,
    rankScore: 10,
    forwardReturnPct: { "1": 1, "3": 2, "5": 3 },
  };
}
