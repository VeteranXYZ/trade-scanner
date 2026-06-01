import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSymbolResearchUrl,
  getSymbolResearchApiBaseUrl,
} from "./SymbolResearchPageClient";

const originalTradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;

describe("symbol research API URL builder", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalTradeApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_TRADE_API_BASE_URL = originalTradeApiBaseUrl;
    }
  });

  it("uses NEXT_PUBLIC_TRADE_API_BASE_URL when present", () => {
    vi.stubEnv("NEXT_PUBLIC_TRADE_API_BASE_URL", "https://api.auere.com");

    const url = buildSymbolResearchUrl({
      exchange: "binance",
      symbol: "SEIUSDT",
    });

    expect(url.startsWith("https://api.auere.com")).toBe(true);
    expect(url).toContain("/api/symbol/research?");
  });

  it("falls back to same-origin symbol research API when the env var is missing", () => {
    delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;

    expect(
      buildSymbolResearchUrl({
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    ).toBe(
      "/api/symbol/research?exchange=binance&market=spot&symbol=SEIUSDT&timeframe=4h&historyLimit=30&candleLimit=120&includeCandles=true&assetClass=crypto",
    );
  });

  it("uppercases symbol and defaults timeframe to 4h", () => {
    const url = buildSymbolResearchUrl({
      exchange: "binance",
      market: "spot",
      symbol: "seiusdt",
      tradeApiBaseUrl: "https://api.auere.com/",
    });

    expect(url).toContain("symbol=SEIUSDT");
    expect(url).toContain("timeframe=4h");
    expect(url.startsWith("https://api.auere.com/api/symbol/research")).toBe(true);
  });

  it("normalizes trailing slashes from the API base URL", () => {
    expect(getSymbolResearchApiBaseUrl("https://api.auere.com///")).toBe(
      "https://api.auere.com",
    );
  });
});
