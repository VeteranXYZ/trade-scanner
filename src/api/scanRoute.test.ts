import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/route";
import { clearMemoryCache } from "@/lib/cache/memory";

const getEligibleUsdtMarketsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getEligibleUsdtMarkets: getEligibleUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarket", () => ({
  scanMarket: vi.fn(),
}));

vi.mock("@/lib/storage/marketData", () => {
  throw new Error("Local SQLite storage was imported");
});

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

describe("scan API remote market universe", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DISABLE_LOCAL_SQLITE", "true");
    clearMemoryCache();
    getEligibleUsdtMarketsMock.mockReset();
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets: [],
      totalUsdtPairs: 420,
      eligibleCount: 420,
      capped: false,
    });
  });

  it("keeps source=remote independent from local SQLite storage", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=remote&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("remote");
    expect(body.universe).toBe("all-eligible-usdt");
    expect(body.scannedMarketCount).toBe(0);
    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith({
      maxSymbols: null,
      minQuoteVolume: 0,
      safetyCap: 600,
    });
  });

  it("does not default to a Top 50 or Top 100 market cap", async () => {
    await GET(new Request("http://localhost/api/scan?timeframe=4h"));

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: null }),
    );
  });

  it("applies maxSymbols only when explicitly provided", async () => {
    await GET(
      new Request("http://localhost/api/scan?timeframe=4h&maxSymbols=100"),
    );

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 100 }),
    );
  });

  it("passes minQuoteVolume into the remote universe filter", async () => {
    await GET(
      new Request(
        "http://localhost/api/scan?timeframe=4h&minQuoteVolume=10000000",
      ),
    );

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ minQuoteVolume: 10000000 }),
    );
  });

  it("blocks source=local when local SQLite is disabled", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=local&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });

  it.each(["1h", "15m", "5m", "1m"])(
    "rejects unsupported lower timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/scan?source=remote&timeframe=${timeframe}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("4h, 1d, 1w, or 1M");
    },
  );

  it.each(["4h", "1d", "1w", "1M"])(
    "accepts supported scanner timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/scan?source=remote&timeframe=${timeframe}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.timeframe).toBe(timeframe);
    },
  );

  it("defaults to 4h and includes cache metadata", async () => {
    const response = await GET(new Request("http://localhost/api/scan?source=remote"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timeframe).toBe("4h");
    expect(body.cached).toBe(false);
    expect(body.cacheTtlSeconds).toBeGreaterThanOrEqual(60 * 60);
    expect(body.cacheExpiresAt).toEqual(expect.any(String));
    expect(body.durationMs).toEqual(expect.any(Number));
  });
});
