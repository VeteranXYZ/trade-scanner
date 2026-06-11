import { describe, expect, it } from "vitest";
import {
  buildArchiveHref,
  buildRankingsHref,
  buildScreenerHref,
  buildSourceAwareResearchReturnLink,
  buildSymbolResearchHref,
  buildWatchlistHref,
  normalizeResearchNavigationSource,
} from "./researchNavigation";

describe("research navigation helpers", () => {
  it("builds symbol research URLs and omits empty optional params", () => {
    expect(
      buildSymbolResearchHref({
        exchange: "Binance",
        symbol: "btcusdt",
        timeframe: "4h",
        assetClass: " ",
        from: "",
        q: "",
        runId: null,
      }),
    ).toBe("/symbol/binance/BTCUSDT?timeframe=4h");
  });

  it("includes stable source, timeframe, and asset class params", () => {
    expect(
      buildSymbolResearchHref({
        exchange: "binance",
        symbol: "BTCUSDT",
        timeframe: "4h",
        assetClass: "crypto",
        from: "rankings",
      }),
    ).toBe(
      "/symbol/binance/BTCUSDT?timeframe=4h&assetClass=crypto&from=rankings",
    );
  });

  it("ignores invalid source names safely", () => {
    expect(normalizeResearchNavigationSource("scanner")).toBeNull();
    expect(
      buildSymbolResearchHref({
        exchange: "binance",
        symbol: "BTCUSDT",
        timeframe: "4h",
        assetClass: "crypto",
        from: "scanner",
      }),
    ).toBe("/symbol/binance/BTCUSDT?timeframe=4h&assetClass=crypto");
  });

  it("builds source-aware return links with preserved context", () => {
    expect(
      buildSourceAwareResearchReturnLink(
        new URLSearchParams(
          "from=rankings&timeframe=1d&assetClass=crypto&sort=rank:desc&limit=200",
        ),
      ),
    ).toEqual({
      source: "rankings",
      label: "Back to Rankings",
      href: "/rankings?timeframe=1d&assetClass=crypto&sort=rank%3Adesc&limit=200",
    });
    expect(
      buildSourceAwareResearchReturnLink(
        new URLSearchParams(
          "from=screener&assetClass=crypto&q=BTC&group=4h:watch&risk=exclude1d&sort=combined_rank:desc",
        ),
      ),
    ).toEqual({
      source: "screener",
      label: "Back to Screener",
      href: "/screener?assetClass=crypto&group=4h%3Awatch&risk=exclude1d&sort=combined_rank%3Adesc&q=BTC",
    });
    expect(
      buildSourceAwareResearchReturnLink(
        new URLSearchParams("from=watchlist&q=ETH&risk=foundOnly&sort=symbol:asc"),
      ),
    ).toEqual({
      source: "watchlist",
      label: "Back to Watchlist",
      href: "/watchlist?risk=foundOnly&sort=symbol%3Aasc&q=ETH",
    });
    expect(
      buildSourceAwareResearchReturnLink(
        new URLSearchParams(
          "from=archive&timeframe=4h&assetClass=crypto&runId=run-1&snapshotId=row-2&symbol=BTCUSDT",
        ),
      ),
    ).toEqual({
      source: "archive",
      label: "Back to Archive",
      href: "/archive?timeframe=4h&assetClass=crypto&runId=run-1&snapshotId=row-2&symbol=BTCUSDT",
    });
  });

  it("returns null for unknown source return links", () => {
    expect(
      buildSourceAwareResearchReturnLink(
        new URLSearchParams("from=history&timeframe=4h"),
      ),
    ).toBeNull();
  });

  it("builds page route URLs with readable params", () => {
    expect(buildRankingsHref({ timeframe: "bad", assetClass: "crypto" })).toBe(
      "/rankings?timeframe=4h&assetClass=crypto",
    );
    expect(buildScreenerHref({ assetClass: "crypto", q: "SEI" })).toBe(
      "/screener?assetClass=crypto&q=SEI",
    );
    expect(buildWatchlistHref({ q: "SOL", risk: "foundOnly" })).toBe(
      "/watchlist?risk=foundOnly&q=SOL",
    );
    expect(
      buildArchiveHref({
        timeframe: "1w",
        assetClass: "crypto",
        symbol: "BTCUSDT",
      }),
    ).toBe("/archive?timeframe=1w&assetClass=crypto&symbol=BTCUSDT");
  });
});
