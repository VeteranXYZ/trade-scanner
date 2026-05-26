import { describe, expect, it } from "vitest";
import {
  parseEvaluateOptions,
  parsePruneOptions,
} from "./researchCli";

describe("research CLI parsing", () => {
  it("rejects unsupported horizons", () => {
    expect(() => parseEvaluateOptions(["--horizon=2h"])).toThrow(
      "horizon must be one of",
    );
  });

  it("rejects limits over the maintenance maximum", () => {
    expect(() => parseEvaluateOptions(["--limit=501"])).toThrow(
      "limit must be an integer between 1 and 500",
    );
  });

  it("defaults prune to dry-run unless execution is explicit", () => {
    expect(parsePruneOptions(["--signal-days=30"]).dryRun).toBe(true);
    expect(parsePruneOptions(["--execute"]).dryRun).toBe(false);
  });
});
