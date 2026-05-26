import { describe, expect, it } from "vitest";
import { cacheKeys, cacheTtls } from "./keys";

describe("scanner cache policy", () => {
  it("uses long medium-to-large timeframe scan TTLs", () => {
    expect(cacheTtls.scan["4h"]).toBeGreaterThanOrEqual(60 * 60 * 1000);
    expect(cacheTtls.scan["1d"]).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(cacheTtls.scan["1w"]).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    expect(cacheTtls.scan["1M"]).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000);
  });

  it("includes source, universe, maxSymbols, minQuoteVolume, and filters in scan keys", () => {
    const key = cacheKeys.scan({
      source: "remote",
      timeframe: "4h",
      universe: "all-eligible-usdt",
      maxSymbols: null,
      minQuoteVolume: 10000000,
      filters: "none",
    });

    expect(key).toContain("remote");
    expect(key).toContain("4h");
    expect(key).toContain("all-eligible-usdt");
    expect(key).toContain("max:all");
    expect(key).toContain("minQuote:10000000");
    expect(key).toContain("filters:none");
  });

  it("includes batch cursor and size in batched scan keys", () => {
    const key = cacheKeys.scan({
      source: "remote",
      timeframe: "4h",
      universe: "all-eligible-usdt",
      maxSymbols: null,
      minQuoteVolume: 0,
      batchMode: true,
      cursor: 35,
      batchSize: 35,
      filters: "none",
    });

    expect(key).toContain("batch:35:35");
  });
});
