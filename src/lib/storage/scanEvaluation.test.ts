import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/exchanges/types";
import {
  evaluateForwardPerformance,
  summarizeForwardEvaluations,
} from "./scanEvaluation";
import type { StoredScanResult, StoredScanSnapshot } from "./scanSnapshots";

describe("forward scan evaluation", () => {
  it("calculates forward return, max upside, and max drawdown", () => {
    const evaluation = evaluateForwardPerformance({
      snapshot: makeSnapshot("2026-05-25T00:00:00.000Z"),
      result: makeResult({ price: 100 }),
      horizonCandles: 3,
      candles: [
        makeCandle({ index: 0, openTime: Date.parse("2026-05-25T01:00:00.000Z"), close: 102, high: 103, low: 99 }),
        makeCandle({ index: 1, openTime: Date.parse("2026-05-25T02:00:00.000Z"), close: 104, high: 106, low: 101 }),
        makeCandle({ index: 2, openTime: Date.parse("2026-05-25T03:00:00.000Z"), close: 105, high: 107, low: 98 }),
      ],
    });

    expect(evaluation.status).toBe("completed");
    expect(evaluation.exitPrice).toBe(105);
    expect(evaluation.returnPct).toBe(5);
    expect(evaluation.maxUpPct).toBeCloseTo(7, 6);
    expect(evaluation.maxDownPct).toBe(-2);
  });

  it("marks evaluations pending until enough future candles exist", () => {
    const evaluation = evaluateForwardPerformance({
      snapshot: makeSnapshot("2026-05-25T00:00:00.000Z"),
      result: makeResult({ price: 100 }),
      horizonCandles: 3,
      candles: [
        makeCandle({ index: 0, openTime: Date.parse("2026-05-25T01:00:00.000Z"), close: 102 }),
      ],
    });

    expect(evaluation.status).toBe("pending");
    expect(evaluation.candlesAvailable).toBe(1);
    expect(evaluation.returnPct).toBeNull();
  });

  it("summarizes completed and pending evaluations by signal", () => {
    const summary = summarizeForwardEvaluations([
      {
        ...baseEvaluation("AAAUSDT", "WATCHLIST"),
        status: "completed",
        returnPct: 5,
        maxUpPct: 8,
        maxDownPct: -1,
      },
      {
        ...baseEvaluation("BBBUSDT", "WATCHLIST"),
        status: "completed",
        returnPct: -2,
        maxUpPct: 1,
        maxDownPct: -4,
      },
      {
        ...baseEvaluation("CCCUSDT", "WATCHLIST"),
        status: "pending",
      },
    ]);

    expect(summary.completedCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.bySignal.WATCHLIST).toMatchObject({
      completedCount: 2,
      pendingCount: 1,
      hitRate: 0.5,
      avgReturnPct: 1.5,
    });
  });
});

function makeSnapshot(createdAt: string): StoredScanSnapshot {
  return {
    id: "snapshot",
    createdAt,
    exchange: "binance",
    mode: "single",
    timeframe: "1h",
    limit: 1,
    itemCount: 1,
    errorsCount: 0,
    results: [],
  };
}

function makeResult({ price }: { price: number }): StoredScanResult {
  return {
    symbol: "BTCUSDT",
    timeframe: "1h",
    price,
    phase: "SQUEEZE",
    signalState: "WATCHLIST",
    signalLabel: "Watchlist",
    rankScore: 50,
    opportunityScore: 80,
    confirmationScore: 20,
    riskScore: 10,
  };
}

function makeCandle({
  index,
  openTime,
  close,
  high = close,
  low = close,
}: {
  index: number;
  openTime: number;
  close: number;
  high?: number;
  low?: number;
}): Candle {
  return {
    openTime,
    open: close,
    high,
    low,
    close,
    volume: 1000,
    closeTime: openTime + index + 1,
  };
}

function baseEvaluation(
  symbol: string,
  signalState: "WATCHLIST" | "HIGH_RISK",
) {
  return {
    snapshotId: "snapshot",
    snapshotCreatedAt: "2026-05-25T00:00:00.000Z",
    symbol,
    timeframe: "1h" as const,
    phase: "SQUEEZE" as const,
    signalState,
    entryPrice: 100,
    horizonCandles: 3,
    candlesAvailable: 3,
    exitPrice: 100,
    returnPct: null,
    maxUpPct: null,
    maxDownPct: null,
  };
}
