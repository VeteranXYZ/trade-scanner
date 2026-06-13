import { describe, expect, it, vi } from "vitest";
import {
  createCcxtCoinbaseProvider,
  fetchCoinbaseCandles,
  listCoinbaseUsdcSpotListings,
  mapCcxtOhlcvRowsToCandles,
  type CcxtClientLike,
  type CcxtMarketLike,
  type CcxtOhlcvRow,
} from "./ccxtCoinbaseProvider";
import { parseMarketSymbol } from "../symbolIdentity";

describe("CCXT Coinbase USDC provider", () => {
  it("keeps only active Coinbase spot USDC markets with complete identity", async () => {
    const client = makeClient({
      markets: {
        "BTC/USDC": market({ id: "BTC-USDC", symbol: "BTC/USDC", base: "BTC" }),
        "ETH/USDC": market({ id: "ETH-USDC", symbol: "ETH/USDC", base: "ETH" }),
        inactive: market({
          id: "OLD-USDC",
          symbol: "OLD/USDC",
          base: "OLD",
          active: false,
        }),
        nonSpot: market({
          id: "PERP-USDC",
          symbol: "PERP/USDC",
          base: "PERP",
          spot: false,
          type: "swap",
        }),
        usdQuote: market({ id: "BTC-USD", symbol: "BTC/USD", base: "BTC", quote: "USD" }),
        usdtQuote: market({
          id: "BTC-USDT",
          symbol: "BTC/USDT",
          base: "BTC",
          quote: "USDT",
        }),
        btcQuote: market({ id: "ETH-BTC", symbol: "ETH/BTC", base: "ETH", quote: "BTC" }),
        malformedId: market({ id: "", symbol: "ABC/USDC", base: "ABC" }),
        malformedBase: market({ id: "ABC-USDC", symbol: "ABC/USDC", base: "" }),
        malformedSymbol: market({ id: "DEF-USDC", symbol: "", base: "DEF" }),
        malformedRawSymbol: market({
          id: "GHI/USDC",
          symbol: "GHI/USDC",
          base: "GHI",
        }),
      },
    });

    const listings = await listCoinbaseUsdcSpotListings(client);

    expect(listings.map((listing) => listing.rawSymbol)).toEqual([
      "BTC-USDC",
      "ETH-USDC",
    ]);
    expect(listings[0]).toMatchObject({
      assetClass: "crypto",
      exchange: "coinbase",
      market: "spot",
      rawSymbol: "BTC-USDC",
      baseAsset: "BTC",
      quoteAsset: "USDC",
      provider: "ccxt",
      providerSymbol: "BTC/USDC",
      canonicalAssetKey: "BTC",
      sourcePriority: 2,
    });
  });

  it("can load markets through dependency-injected CCXT-like clients", async () => {
    const loadMarkets = vi.fn(async () => [
      market({ id: "SOL-USDC", symbol: "SOL/USDC", base: "SOL" }),
    ]);
    const client = makeClient({ loadMarkets });

    const listings = await createCcxtCoinbaseProvider(client).listMarkets();

    expect(loadMarkets).toHaveBeenCalledOnce();
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      rawSymbol: "SOL-USDC",
      providerSymbol: "SOL/USDC",
      canonicalAssetKey: "SOL",
    });
  });

  it("maps CCXT OHLCV rows to internal candles sorted by open time", () => {
    expect(
      mapCcxtOhlcvRowsToCandles(
        [
          [7_200_000, "200", "230", "190", "220", "20"],
          [3_600_000, "100", "120", "90", "110", "10"],
        ],
        "1h",
      ),
    ).toEqual([
      {
        openTime: 3_600_000,
        open: 100,
        high: 120,
        low: 90,
        close: 110,
        volume: 10,
        closeTime: 7_199_999,
      },
      {
        openTime: 7_200_000,
        open: 200,
        high: 230,
        low: 190,
        close: 220,
        volume: 20,
        closeTime: 10_799_999,
      },
    ]);
  });

  it.each([
    ["1h", 60 * 60 * 1000],
    ["4h", 4 * 60 * 60 * 1000],
    ["1d", 24 * 60 * 60 * 1000],
  ] as const)("supports %s candle close time mapping", (timeframe, durationMs) => {
    const [candle] = mapCcxtOhlcvRowsToCandles(
      [[1_000, 1, 2, 0.5, 1.5, 100]],
      timeframe,
    );

    expect(candle).toMatchObject({
      openTime: 1_000,
      closeTime: 1_000 + durationMs - 1,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
    });
    expect(candle).not.toHaveProperty("quoteVolume");
  });

  it("fetches Coinbase OHLCV with provider symbol, timeframe, since, and limit", async () => {
    const fetchOHLCV = vi.fn(async () => [
      [1_000, 1, 2, 0.5, 1.5, 100] satisfies CcxtOhlcvRow,
    ]);
    const client = makeClient({ fetchOHLCV });
    const listing = parseMarketSymbol({
      exchange: "coinbase",
      rawSymbol: "BTC-USDC",
      provider: "ccxt",
      providerSymbol: "BTC/USDC",
    });

    const result = await fetchCoinbaseCandles(client, listing, "4h", {
      since: 123,
      limit: 50,
    });

    expect(fetchOHLCV).toHaveBeenCalledWith("BTC/USDC", "4h", 123, 50, {});
    expect(result).toMatchObject({
      provider: "ccxt",
      exchange: "coinbase",
      market: "spot",
      rawSymbol: "BTC-USDC",
      providerSymbol: "BTC/USDC",
      timeframe: "4h",
      candles: [
        {
          openTime: 1_000,
          closeTime: 14_400_999,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 100,
        },
      ],
    });
  });

  it("rejects unsupported weekly candles without calling the client", async () => {
    const fetchOHLCV = vi.fn(async () => [
      [1_000, 1, 2, 0.5, 1.5, 100] satisfies CcxtOhlcvRow,
    ]);
    const client = makeClient({ fetchOHLCV });
    const listing = parseMarketSymbol({
      exchange: "coinbase",
      rawSymbol: "BTC-USDC",
      provider: "ccxt",
      providerSymbol: "BTC/USDC",
    });

    await expect(fetchCoinbaseCandles(client, listing, "1w")).rejects.toThrow(
      "weekly aggregation is deferred",
    );
    expect(fetchOHLCV).not.toHaveBeenCalled();
  });

  it("fails clearly when the CCXT client does not expose a requested timeframe", async () => {
    const client = makeClient({ timeframes: { "1h": "1h", "1d": "1d" } });
    const listing = parseMarketSymbol({
      exchange: "coinbase",
      rawSymbol: "ETH-USDC",
      provider: "ccxt",
      providerSymbol: "ETH/USDC",
    });

    await expect(fetchCoinbaseCandles(client, listing, "4h")).rejects.toThrow(
      "does not support timeframe 4h",
    );
  });
});

function market(overrides: Partial<CcxtMarketLike>): CcxtMarketLike {
  return {
    id: "BTC-USDC",
    symbol: "BTC/USDC",
    base: "BTC",
    quote: "USDC",
    active: true,
    spot: true,
    type: "spot",
    ...overrides,
  };
}

function makeClient(
  overrides: Partial<CcxtClientLike> = {},
): CcxtClientLike {
  return {
    markets: {},
    timeframes: { "1h": "1h", "4h": "4h", "1d": "1d" },
    fetchOHLCV: vi.fn(async () => []),
    ...overrides,
  };
}
