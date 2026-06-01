import { describe, expect, it } from "vitest";
import {
  formatTimelineDate,
  formatTimelineScore,
  getTimelineGroupLabel,
  getTimelineRiskText,
  normalizeSignalHistory,
} from "./symbolTimelineUi";

describe("symbol timeline UI helpers", () => {
  it("normalizes empty history safely", () => {
    expect(normalizeSignalHistory([])).toEqual([]);
    expect(normalizeSignalHistory(null)).toEqual([]);
  });

  it("formats invalid dates without crashing", () => {
    expect(formatTimelineDate("not-a-date")).toBe("Not available");
    expect(formatTimelineDate(null)).toBe("Not available");
  });

  it("sorts by scanTime descending without mutating the source array", () => {
    const history = [
      {
        id: "older",
        scanTime: "2026-05-30T00:00:00.000Z",
        candleOpenTime: "2026-05-29T20:00:00.000Z",
      },
      {
        id: "newer",
        scanTime: "2026-05-31T00:00:00.000Z",
        candleOpenTime: "2026-05-30T20:00:00.000Z",
      },
    ];

    expect(normalizeSignalHistory(history).map((item) => item.key)).toEqual([
      "newer",
      "older",
    ]);
    expect(history.map((item) => item.id)).toEqual(["older", "newer"]);
  });

  it("formats missing scores safely", () => {
    expect(formatTimelineScore(null)).toBe("-");
    expect(formatTimelineScore(undefined)).toBe("-");
    expect(formatTimelineScore(Number.NaN)).toBe("-");
    expect(formatTimelineScore(72.24)).toBe("72.2");
  });

  it("formats risk types readably", () => {
    expect(getTimelineRiskText(["weak_bounce_risk", "failed_breakout_risk"])).toBe(
      "Weak Bounce Risk, Failed Breakout Risk",
    );
    expect(getTimelineRiskText([{ risk: true }])).toBe("No specific risk types noted.");
  });

  it("uses a safe group label fallback", () => {
    expect(getTimelineGroupLabel("eligible")).toBe("Eligible");
    expect(getTimelineGroupLabel("unknown_group")).toBe("Neutral");
  });
});
