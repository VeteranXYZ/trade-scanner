import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  WatchlistSummaryCards,
  WatchlistResearchSummaryPanel,
  WatchlistTable,
  buildWatchlistMtfLatestScanUrl,
} from "./WatchlistPageClient";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  buildWatchlistResearchSummary,
  buildWatchlistRows,
  getWatchlistSummary,
} from "./watchlistUi";
import {
  buildMtfScreenerRowsFromResponse,
  buildMtfScreenerRows,
  type MtfLatestScanResponse,
} from "@/components/screener/multiTimeframeScreenerUi";
import { buildWatchlistVisualCheckData } from "./watchlistPreviewData";

describe("WatchlistPageClient", () => {
  it("uses the full multi-timeframe latest API endpoint", () => {
    expect(
      buildWatchlistMtfLatestScanUrl({
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe("https://api.auere.com/api/scan/mtf-latest?assetClass=crypto");
  });

  it("renders default symbols and the watchlist table", () => {
    const rows = buildWatchlistRows(
      DEFAULT_WATCHLIST_SYMBOLS,
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "BTCUSDT",
            timeframe: "4h",
            resultGroup: "watch",
            rankScore: 72.5,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WatchlistSummaryCards, {
          summary: getWatchlistSummary(rows),
          researchSummary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistResearchSummaryPanel, {
          summary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistTable, { rows }),
      ),
    );

    expect(html).toContain("Selected");
    expect(html).toContain("Found");
    expect(html).toContain("Missing");
    expect(html).toContain("Attention");
    expect(html).toContain("Watch / Repair");
    expect(html).toContain("Risk First");
    expect(html).toContain("Data Gaps");
    expect(html).not.toContain("Best Research Candidates");
    expect(html).toContain("Selected Symbols");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("SEIUSDT");
    expect(html).toContain("State + Rank");
    expect(html).toContain("4h");
    expect(html).toContain("72.5");
    expect(html).toContain("Not found");
  });

  it("renders missing timeframes and selected research links", () => {
    const rows = buildWatchlistRows(
      ["SEI", "LINK"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "SEIUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 81,
          }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({
            symbol: "LINKUSDT",
            timeframe: "1d",
            resultGroup: "risk",
            rankScore: 18,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, { rows }),
    );

    expect(html).toContain("Not returned");
    expect(html).toContain("1h Research");
    expect(html).toContain("1d Research");
    expect(html).toContain(
      'href="/symbol/binance/SEIUSDT?timeframe=1h&amp;assetClass=crypto&amp;from=watchlist"',
    );
  });

  it("renders all table rows by default without show-more behavior", () => {
    const symbols = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH"];
    const rows = buildWatchlistRows(
      symbols,
      buildMtfScreenerRows({
        "4h": makeResponse(
          "4h",
          symbols.map((symbol, index) =>
            makeItem({
              symbol: `${symbol}USDT`,
              timeframe: "4h",
              resultGroup: index % 2 === 0 ? "watch" : "neutral",
              rankScore: 60 + index,
            }),
          ),
        ),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, { rows }),
    );

    for (const symbol of symbols) {
      expect(html).toContain(`${symbol}USDT`);
    }

    expect(html).toContain("Showing 8 of 8");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
    expect(html).not.toContain("+1 more");
    expect(html).not.toContain("Pagination");
  });

  it("still renders watchlist rows when market context is unavailable", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "BTCUSDT",
            timeframe: "4h",
            resultGroup: "risk",
            rankScore: -24,
          }),
          makeItem({
            symbol: "ETHUSDT",
            timeframe: "4h",
            resultGroup: "risk",
            rankScore: -20,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(MarketContextPanel, { isError: true }),
        createElement(WatchlistTable, { rows }),
      ),
    );

    expect(html).toContain("Market context unavailable");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("ETHUSDT");
    expect(html).toContain("Selected Symbols");
  });

  it("renders compact remove actions when a row removal handler is provided", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h" }),
          makeItem({ symbol: "ETHUSDT", timeframe: "4h" }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, {
        rows,
        onRemoveSymbol: () => undefined,
      }),
    );

    expect(html).toContain("Remove");
    expect(html.match(/<button[^>]*>Remove<\/button>/g)).toHaveLength(2);
  });

  it("renders table-header sort controls for data columns", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h", rankScore: 75 }),
          makeItem({ symbol: "ETHUSDT", timeframe: "4h", rankScore: 65 }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, {
        rows,
        sortState: { key: "symbol", direction: "asc" },
        onSortChange: () => undefined,
      }),
    );

    expect(html.match(/<button/g)).toHaveLength(7);
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain("Symbol");
    expect(html).toContain("1h");
    expect(html).toContain("4h");
    expect(html).toContain("1d");
    expect(html).toContain("1w");
    expect(html).toContain("Primary");
    expect(html).toContain("Attention");
  });

  it("renders populated visual-check watchlist coverage", () => {
    const visualCheckData = buildWatchlistVisualCheckData();
    const rows = buildWatchlistRows(
      visualCheckData.selectedSymbols,
      buildMtfScreenerRowsFromResponse(visualCheckData.latestData),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WatchlistSummaryCards, {
          summary: getWatchlistSummary(rows),
          researchSummary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistResearchSummaryPanel, {
          summary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistTable, {
          rows,
          sourceData: visualCheckData.latestData,
          totalRows: rows.length,
          filteredRows: rows.length,
        }),
      ),
    );

    expect(visualCheckData.selectedSymbols).toContain("MISSINGUSDT");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("DOGEUSDT");
    expect(html).toContain("MISSINGUSDT");
    expect(html).toContain("Hot");
    expect(html).toContain("Risk");
    expect(html).toContain("Watch");
    expect(html).toContain("Not found");
    expect(html).toContain("Not returned");
    expect(html).toContain("4h Research");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
  });
});

function makeResponse(
  timeframe: "1h" | "4h" | "1d" | "1w",
  items: MtfLatestScanResponse["items"],
): MtfLatestScanResponse {
  return {
    ok: true,
    timeframe,
    assetClass: "crypto",
    run: null,
    summary: null,
    count: items.length,
    items,
  };
}

function makeItem(
  overrides: Partial<MtfLatestScanResponse["items"][number]> & {
    symbol: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
  },
): MtfLatestScanResponse["items"][number] {
  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: overrides.timeframe,
    resultGroup: overrides.resultGroup ?? "neutral",
    rankScore: overrides.rankScore ?? 0,
    signalLabel: overrides.signalLabel ?? "watch",
    detectedRiskTypes: overrides.detectedRiskTypes ?? [],
  };
}
