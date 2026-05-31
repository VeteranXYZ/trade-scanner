import { describe, expect, it } from "vitest";
import {
  formatActionBias,
  formatDateTime,
  formatGroupHint,
  formatGroupLabel,
  formatPrice,
  formatQualityTier,
  formatScore,
  formatSignalLabel,
  getResultGroupSortOrder,
  normalizeGroupKey,
} from "./latestScanUi";

describe("latest scan UI helpers", () => {
  it("formats nullable scores and prices safely", () => {
    expect(formatScore(72.256)).toBe("72.3");
    expect(formatScore(null)).toBe("-");
    expect(formatPrice(1234.567)).toBe("1,234.57");
    expect(formatPrice(0.000012345)).toBe("0.000012345");
    expect(formatPrice(undefined)).toBe("-");
  });

  it("formats readable labels without buy or sell language", () => {
    expect(formatSignalLabel("breakdown_risk")).toBe("Breakdown Risk");
    expect(formatActionBias("do_not_chase")).toBe("Do Not Chase");
    expect(formatQualityTier("wrapped_or_staked")).toBe("Wrapped/Staked");
    expect(formatGroupLabel("eligible")).toBe("Eligible");
    expect(formatGroupHint("eligible")).toContain("manual review");
  });

  it("normalizes backend group key variants", () => {
    expect(normalizeGroupKey("insufficientHistory")).toBe("insufficient_history");
    expect(normalizeGroupKey("risk")).toBe("risk");
    expect(normalizeGroupKey("unknown")).toBe("neutral");
    expect(getResultGroupSortOrder("eligible")).toBeLessThan(
      getResultGroupSortOrder("risk"),
    );
  });

  it("falls back for invalid dates", () => {
    expect(formatDateTime(null)).toBe("Not available");
    expect(formatDateTime("not-a-date")).toBe("Not available");
  });
});
