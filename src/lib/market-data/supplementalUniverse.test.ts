import { describe, expect, it } from "vitest";
import {
  COINBASE_SUPPLEMENTAL_PRIORITY,
  selectSupplementalUniverse,
} from "./supplementalUniverse";
import { parseMarketSymbol, type MarketListing } from "./symbolIdentity";

describe("supplemental research universe selection", () => {
  it("keeps Binance primary listings ahead of supplemental listings", () => {
    const rows = selectSupplementalUniverse({
      primaryListings: [
        binance("ETHUSDT", "ETH", 900),
        binance("BTCUSDT", "BTC", 1_000),
      ],
      supplementalListings: [coinbase("ABC-USDC", 1_200)],
    });

    expect(rows.map((row) => row.rawSymbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "ABC-USDC",
    ]);
    expect(rows[0]).toMatchObject({
      exchange: "binance",
      rawSymbol: "BTCUSDT",
      selectionRole: "primary",
      sourcePriority: 1,
    });
  });

  it("skips Coinbase USDC listings when Binance already covers the base asset", () => {
    const rows = selectSupplementalUniverse({
      primaryListings: [
        binance("BTCUSDT", "BTC", 1_000),
        binance("ETHUSDT", "ETH", 900),
        binance("NEARUSDT", "NEAR", 800),
      ],
      supplementalListings: [
        coinbase("BTC-USDC", 1_100),
        coinbase("ETH-USDC", 1_000),
        coinbase("NEAR-USDC", 700),
      ],
    });

    expect(rows.map((row) => row.rawSymbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "NEARUSDT",
    ]);
    expect(new Set(rows.map((row) => row.canonicalAssetKey)).size).toBe(rows.length);
  });

  it("includes Coinbase-only assets after primary Binance listings", () => {
    const rows = selectSupplementalUniverse({
      primaryListings: [binance("BTCUSDT", "BTC", 1_000)],
      supplementalListings: [
        coinbase("BTC-USDC", 1_100),
        coinbase("ABC-USDC", 900),
      ],
    });

    expect(rows.map((row) => row.rawSymbol)).toEqual(["BTCUSDT", "ABC-USDC"]);
    expect(rows[1]).toMatchObject({
      exchange: "coinbase",
      baseAsset: "ABC",
      quoteAsset: "USDC",
      selectionRole: "supplemental",
    });
  });

  it("uses deterministic ordering within the same source priority", () => {
    const rows = selectSupplementalUniverse({
      primaryListings: [binance("LOWUSDT", "LOW", 100)],
      supplementalListings: [
        coinbase("CCC-USDC", 300),
        coinbase("AAA-USDC", 300),
        coinbase("BBB-USDC", 400),
      ],
    });

    expect(rows.map((row) => row.rawSymbol)).toEqual([
      "LOWUSDT",
      "BBB-USDC",
      "AAA-USDC",
      "CCC-USDC",
    ]);
  });

  it("preserves exact canonical base semantics without aliasing", () => {
    const rows = selectSupplementalUniverse({
      primaryListings: [
        binance("BTCUSDT", "BTC", 1_000),
        binance("SOLUSDT", "SOL", 900),
        binance("SATSUSDT", "SATS", 800),
      ],
      supplementalListings: [
        coinbase("WBTC-USDC", 700),
        coinbase("BNSOL-USDC", 600),
        coinbase("1000SATS-USDC", 500),
      ],
    });

    expect(rows.map((row) => row.canonicalAssetKey)).toEqual([
      "BTC",
      "SOL",
      "SATS",
      "WBTC",
      "BNSOL",
      "1000SATS",
    ]);
  });
});

function binance(symbol: string, baseAsset: string, quoteVolume: number): MarketListing {
  return parseMarketSymbol({
    exchange: "binance",
    rawSymbol: symbol,
    baseAsset,
    quoteAsset: "USDT",
    quoteVolume,
  });
}

function coinbase(symbol: string, quoteVolume: number): MarketListing {
  return parseMarketSymbol({
    exchange: "coinbase",
    rawSymbol: symbol,
    quoteVolume,
    sourcePriority: COINBASE_SUPPLEMENTAL_PRIORITY,
  });
}
