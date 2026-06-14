import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBinanceKlines, mapBinanceKlineToCandle } from "./binanceProvider";

describe("Binance market data provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps public kline rows to local candles", () => {
    expect(
      mapBinanceKlineToCandle([
        1,
        "100",
        "110",
        "90",
        "105",
        "123.45",
        999,
        "12345.67",
        42,
        "10",
        "1000",
        "0",
      ]),
    ).toEqual({
      openTime: 1,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 123.45,
      closeTime: 999,
      quoteVolume: 12345.67,
    });
  });

  it("keeps Binance ingestion on native public klines", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;

      return new Response(
        JSON.stringify([
          [
            1,
            "100",
            "110",
            "90",
            "105",
            "123.45",
            999,
            "12345.67",
            42,
            "10",
            "1000",
            "0",
          ],
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const candles = await fetchBinanceKlines({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 200,
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v3/klines");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("symbol=BTCUSDT");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("interval=4h");
    expect(candles).toHaveLength(1);
  });
});
