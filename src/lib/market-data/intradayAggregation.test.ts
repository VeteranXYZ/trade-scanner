import type { Candle } from "@/lib/shared/timeframes";
import { describe, expect, it } from "vitest";
import {
  aggregateHourlyCandlesToFourHour,
  getFourHourUtcBucketStartMs,
} from "./intradayAggregation";

const hourMs = 60 * 60 * 1000;
const fourHourMs = 4 * hourMs;

describe("intraday candle aggregation", () => {
  it("aggregates 4 consecutive hourly candles into one 4h candle", () => {
    const start = Date.UTC(2026, 0, 1, 0);
    const result = aggregateHourlyCandlesToFourHour([
      makeHourlyCandle(start, { open: 100, high: 105, low: 98, close: 101, volume: 10, quoteVolume: 1000 }),
      makeHourlyCandle(start + hourMs, { open: 101, high: 108, low: 100, close: 104, volume: 11, quoteVolume: 1100 }),
      makeHourlyCandle(start + 2 * hourMs, { open: 104, high: 106, low: 97, close: 99, volume: 12, quoteVolume: 1200 }),
      makeHourlyCandle(start + 3 * hourMs, { open: 99, high: 103, low: 96, close: 102, volume: 13, quoteVolume: 1300 }),
    ]);

    expect(result.fourHourCandles).toEqual([
      {
        openTime: start,
        closeTime: start + fourHourMs - 1,
        open: 100,
        high: 108,
        low: 96,
        close: 102,
        volume: 46,
        quoteVolume: 4600,
      },
    ]);
    expect(result.diagnostics).toMatchObject({
      totalBuckets: 1,
      completeBuckets: 1,
      partialBuckets: 0,
      droppedPartialBuckets: 0,
      gapsDetected: 0,
    });
  });

  it("aligns buckets to UTC 00:00, 04:00, 08:00 boundaries", () => {
    const start = Date.UTC(2026, 0, 1, 4);
    const result = aggregateHourlyCandlesToFourHour([
      makeHourlyCandle(start),
      makeHourlyCandle(start + hourMs),
      makeHourlyCandle(start + 2 * hourMs),
      makeHourlyCandle(start + 3 * hourMs),
    ]);

    expect(getFourHourUtcBucketStartMs(start + 2 * hourMs)).toBe(start);
    expect(result.fourHourCandles[0]?.openTime).toBe(start);
    expect(result.fourHourCandles[0]?.closeTime).toBe(start + fourHourMs - 1);
  });

  it("drops incomplete 4h buckets by default", () => {
    const start = Date.UTC(2026, 0, 1, 0);
    const result = aggregateHourlyCandlesToFourHour([
      makeHourlyCandle(start),
      makeHourlyCandle(start + hourMs),
      makeHourlyCandle(start + 2 * hourMs),
    ]);

    expect(result.fourHourCandles).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      totalBuckets: 1,
      completeBuckets: 0,
      partialBuckets: 1,
      droppedPartialBuckets: 1,
    });
  });

  it("reports gaps when a missing hourly candle creates a partial bucket", () => {
    const start = Date.UTC(2026, 0, 1, 0);
    const result = aggregateHourlyCandlesToFourHour([
      makeHourlyCandle(start),
      makeHourlyCandle(start + hourMs),
      makeHourlyCandle(start + 3 * hourMs),
      makeHourlyCandle(start + 4 * hourMs),
      makeHourlyCandle(start + 5 * hourMs),
      makeHourlyCandle(start + 6 * hourMs),
      makeHourlyCandle(start + 7 * hourMs),
    ]);

    expect(result.fourHourCandles).toHaveLength(1);
    expect(result.fourHourCandles[0]?.openTime).toBe(start + fourHourMs);
    expect(result.diagnostics).toMatchObject({
      totalBuckets: 2,
      completeBuckets: 1,
      partialBuckets: 1,
      droppedPartialBuckets: 1,
      gapsDetected: 1,
    });
    expect(result.diagnostics.normalizedInput.missingOpenTimes).toEqual([
      start + 2 * hourMs,
    ]);
  });

  it("normalizes unordered input before aggregation", () => {
    const start = Date.UTC(2026, 0, 1, 8);
    const result = aggregateHourlyCandlesToFourHour([
      makeHourlyCandle(start + 3 * hourMs, { close: 130 }),
      makeHourlyCandle(start + hourMs),
      makeHourlyCandle(start, { open: 100 }),
      makeHourlyCandle(start + 2 * hourMs),
    ]);

    expect(result.fourHourCandles).toHaveLength(1);
    expect(result.fourHourCandles[0]).toMatchObject({
      openTime: start,
      open: 100,
      close: 130,
    });
    expect(result.diagnostics.normalizedInput.sortedCandleCount).toBe(4);
  });
});

function makeHourlyCandle(openTime: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    closeTime: openTime + hourMs - 1,
    open: 100,
    high: 105,
    low: 95,
    close: 101,
    volume: 10,
    ...overrides,
  };
}
