import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgSymbolResearchStore } from "./symbolResearchPg";

describe("PgSymbolResearchStore", () => {
  it("uses latest scan run selection before loading the latest symbol signal", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgSymbolResearchStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        if (queries.length === 1) {
          return { rows: [makeSymbolRow("SEIUSDT")] };
        }

        if (queries.length === 2) {
          return {
            rows: [
              makeRunRow("full-run", {
                symbols_total: 413,
                symbols_scanned: 409,
                signals_created: 409,
                params: { assetClass: "crypto", allSymbols: true },
              }),
            ],
          };
        }

        return {
          rows: [
            makeSignalRow({
              id: "signal-1",
              scan_run_id: "full-run",
              symbol: "SEIUSDT",
            }),
          ],
        };
      }),
    );

    const latest = await store.getSymbolResearchLatestSignalPg({
      exchange: "binance",
      market: "spot",
      symbol: "seiusdt",
      timeframe: "4h",
      assetClass: "crypto",
    });

    expect(latest.symbol?.symbol).toBe("SEIUSDT");
    expect(latest.scanRun?.id).toBe("full-run");
    expect(latest.signal?.scanRunId).toBe("full-run");
    expect(paramsList[1]).toEqual(["4h", 300, "crypto"]);
    expect(queries[1]).toContain("symbols_total >= $2 OR symbols_scanned >= $2");
    expect(queries[1]).not.toMatch(/max\(scan_time\)/i);
    expect(queries[2]).toContain("ss.scan_run_id = $1");
    expect(queries[2]).not.toMatch(/max\(scan_time\)/i);
  });

  it("returns a clean null signal when the selected latest run has no symbol row", async () => {
    const store = new PgSymbolResearchStore(
      makePool((_sql, _params, callIndex) => {
        if (callIndex === 0) {
          return { rows: [makeSymbolRow("SEIUSDT")] };
        }

        if (callIndex === 1) {
          return { rows: [makeRunRow("full-run")] };
        }

        return { rows: [] };
      }),
    );

    const latest = await store.getSymbolResearchLatestSignalPg({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "4h",
    });

    expect(latest.symbol?.symbol).toBe("SEIUSDT");
    expect(latest.scanRun?.id).toBe("full-run");
    expect(latest.signal).toBeNull();
  });

  it("loads history by symbol and timeframe ordered by scan_time desc", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgSymbolResearchStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);
        return {
          rows: [
            makeSignalRow({
              id: "signal-2",
              scan_run_id: "run-2",
              symbol: "SEIUSDT",
              scan_time: "2026-05-31T04:00:00.000Z",
            }),
          ],
        };
      }),
    );

    const history = await store.getSymbolSignalHistoryPg({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "4h",
      historyLimit: 30,
    });

    expect(history).toHaveLength(1);
    expect(paramsList[0]).toEqual(["binance", "spot", "SEIUSDT", "4h", "crypto", 30]);
    expect(queries[0]).toContain("ORDER BY ss.scan_time DESC");
    expect(queries[0]).toContain("LIMIT $6");
    expect(queries[0]).not.toMatch(/max\(scan_time\)/i);
  });

  it("loads latest available signals by timeframe without max(scan_time)", async () => {
    const queries: string[] = [];
    const store = new PgSymbolResearchStore(
      makePool((sql) => {
        queries.push(sql);
        return {
          rows: [
            makeSignalRow({
              id: "signal-4h",
              scan_run_id: "run-4h",
              symbol: "SEIUSDT",
              timeframe: "4h",
            }),
            makeSignalRow({
              id: "signal-1d",
              scan_run_id: "run-1d",
              symbol: "SEIUSDT",
              timeframe: "1d",
            }),
          ],
        };
      }),
    );

    const rows = await store.getSymbolLatestSignalsByTimeframesPg({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframes: ["4h", "1d"],
    });

    expect(rows.map((row) => row.timeframe)).toEqual(["4h", "1d"]);
    expect(queries[0]).toContain("SELECT DISTINCT ON (ss.timeframe)");
    expect(queries[0]).toContain("ss.scan_time DESC");
    expect(queries[0]).not.toMatch(/max\(scan_time\)/i);
  });

  it("returns recent candles in ascending order after selecting the newest rows", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgSymbolResearchStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);
        return {
          rows: [
            makeCandleRow({ id: "1", open_time_ms: "1000" }),
            makeCandleRow({ id: "2", open_time_ms: "2000" }),
          ],
        };
      }),
    );

    const candles = await store.getSymbolCandlesPg({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "4h",
      candleLimit: 120,
    });

    expect(candles.map((candle) => candle.openTime)).toEqual([1000, 2000]);
    expect(paramsList[0]).toEqual(["binance", "spot", "SEIUSDT", "4h", 120]);
    expect(queries[0]).toContain("ORDER BY open_time DESC");
    expect(queries[0]).toContain("ORDER BY open_time_ms ASC");
  });
});

function makePool(
  query: (
    sql: string,
    params: unknown[],
    callIndex: number,
  ) => { rows: unknown[] },
): Pool {
  let callIndex = 0;

  return {
    query: (sql: string, params: unknown[] = []) => {
      const result = query(sql, params, callIndex);
      callIndex += 1;
      return Promise.resolve(result);
    },
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

function makeSymbolRow(symbol: string) {
  return {
    id: "1",
    exchange: "binance",
    market: "spot",
    symbol,
    base_asset: symbol.replace(/USDT$/, ""),
    quote_asset: "USDT",
    status: "TRADING",
    quote_volume: "1000000",
    price_change_percent: "1.2",
    is_enabled: true,
    asset_class: "crypto",
    is_scanner_eligible: true,
    is_backtest_eligible: true,
    is_market_context: false,
    metadata: {},
    updated_at: "2026-05-31T00:00:00.000Z",
  };
}

function makeRunRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbols_total: overrides.symbols_total ?? 413,
    symbols_scanned: overrides.symbols_scanned ?? 409,
    signals_created: overrides.signals_created ?? 409,
    symbols_skipped: 4,
    failed_symbols: 0,
    params: overrides.params ?? {},
    error_message: null,
    started_at: "2026-05-31T00:00:00.000Z",
    finished_at: "2026-05-31T00:01:00.000Z",
  };
}

function makeSignalRow(
  overrides: Partial<Record<string, unknown>> & {
    id: string;
    scan_run_id: string;
    symbol: string;
  },
) {
  return {
    id: overrides.id,
    scan_run_id: overrides.scan_run_id,
    symbol_id: "1",
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol,
    timeframe: overrides.timeframe ?? "4h",
    scan_time: overrides.scan_time ?? "2026-05-31T00:00:01.000Z",
    candle_open_time: "2026-05-30T20:00:00.000Z",
    price_at_signal: "1.23",
    rank_score: "50",
    final_signal_score: "52",
    opportunity_score: "55",
    confirmation_score: "60",
    risk_score: "12",
    trend_score: "70",
    momentum_score: "65",
    volume_score: "45",
    structure_score: "80",
    signal_label: "confirmed",
    action_bias: "eligible",
    primary_structure: "strong_trend",
    secondary_structures: [],
    detected_risk_types: [],
    factors: {},
    next_confirmation: null,
    invalidation: null,
    raw_metrics: {},
    scoring_version: "test",
    scanner_version: "test",
    created_at: "2026-05-31T00:00:02.000Z",
    asset_class: "crypto",
    is_scanner_eligible: true,
    is_backtest_eligible: true,
    is_market_context: false,
    candle_count: "1000",
    first_open_time: "2024-01-01T00:00:00.000Z",
  };
}

function makeCandleRow(overrides: Partial<Record<string, unknown>>) {
  return {
    id: overrides.id,
    symbol_id: "1",
    exchange: "binance",
    market: "spot",
    symbol: "SEIUSDT",
    timeframe: "4h",
    open_time_ms: overrides.open_time_ms,
    close_time_ms: "3000",
    open: "1",
    high: "2",
    low: "0.5",
    close: "1.5",
    volume: "100",
    quote_volume: "150",
  };
}
