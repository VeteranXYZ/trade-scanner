import { describe, expect, it } from "vitest";
import {
  buildListingId,
  getCanonicalAssetKey,
  getMarketDedupKey,
  marketToListing,
  parseMarketSymbol,
} from "./symbolIdentity";

describe("market symbol identity", () => {
  it("parses Binance USDT spot symbols into base and quote assets", () => {
    expect(parseMarketSymbol({ exchange: "binance", rawSymbol: "BTCUSDT" })).toMatchObject({
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      rawSymbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      provider: "native-binance",
      providerSymbol: "BTCUSDT",
      canonicalAssetKey: "BTC",
      sourcePriority: 1,
    });

    expect(parseMarketSymbol({ exchange: "binance", rawSymbol: "ETHUSDT" })).toMatchObject({
      baseAsset: "ETH",
      quoteAsset: "USDT",
      canonicalAssetKey: "ETH",
    });
  });

  it("parses Coinbase USDC spot symbols into base and quote assets", () => {
    expect(parseMarketSymbol({ exchange: "coinbase", rawSymbol: "BTC-USDC" })).toMatchObject({
      assetClass: "crypto",
      exchange: "coinbase",
      market: "spot",
      rawSymbol: "BTC-USDC",
      baseAsset: "BTC",
      quoteAsset: "USDC",
      provider: "ccxt",
      providerSymbol: "BTC-USDC",
      canonicalAssetKey: "BTC",
      sourcePriority: 2,
    });

    expect(parseMarketSymbol({ exchange: "coinbase", rawSymbol: "ETH-USDC" })).toMatchObject({
      baseAsset: "ETH",
      quoteAsset: "USDC",
      canonicalAssetKey: "ETH",
    });
  });

  it("uses exact uppercase base asset as the canonical dedup key", () => {
    expect(getCanonicalAssetKey({ baseAsset: "btc" })).toBe("BTC");
    expect(getMarketDedupKey({ baseAsset: "near" })).toBe("NEAR");
  });

  it("does not alias wrapped, staked, or unit-prefixed assets", () => {
    expect(getCanonicalAssetKey({ baseAsset: "WBTC" })).toBe("WBTC");
    expect(getCanonicalAssetKey({ baseAsset: "BNSOL" })).toBe("BNSOL");
    expect(getCanonicalAssetKey({ baseAsset: "1000SATS" })).toBe("1000SATS");
    expect(getCanonicalAssetKey({ baseAsset: "WBETH" })).toBe("WBETH");
    expect(getCanonicalAssetKey({ baseAsset: "STETH" })).toBe("STETH");
  });

  it("fails conservatively for unsupported symbol shapes", () => {
    expect(() => parseMarketSymbol({ exchange: "binance", rawSymbol: "BTC-USDC" })).toThrow(
      "Unsupported Binance spot symbol",
    );
    expect(() => parseMarketSymbol({ exchange: "coinbase", rawSymbol: "BTCUSDC" })).toThrow(
      "Unsupported Coinbase spot symbol",
    );
    expect(() => getCanonicalAssetKey({ baseAsset: "BTC/USD" })).toThrow(
      "Invalid base asset",
    );
  });

  it("rejects explicit base and quote assets that do not match the raw symbol", () => {
    expect(() =>
      parseMarketSymbol({
        exchange: "coinbase",
        rawSymbol: "BTC-USDC",
        baseAsset: "ETH",
        quoteAsset: "USDC",
      }),
    ).toThrow("does not match");
  });

  it("builds stable listing ids and converts existing Market rows", () => {
    const listing = marketToListing({
      exchange: "binance",
      symbol: "NEARUSDT",
      baseAsset: "NEAR",
      quoteAsset: "USDT",
      status: "TRADING",
      quoteVolume: 100,
    });

    expect(listing).toMatchObject({
      rawSymbol: "NEARUSDT",
      provider: "native-binance",
      canonicalAssetKey: "NEAR",
    });
    expect(buildListingId(listing)).toBe("crypto:binance:spot:NEARUSDT");
  });
});
