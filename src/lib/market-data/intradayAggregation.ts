import type { Candle } from "@/lib/shared/timeframes";
import { getCandleTimeframeDurationMs } from "./candleBackfillPlanner";
import {
  normalizeCandles,
  type CandleContinuityDiagnostics,
} from "./candleQuality";

export type FourHourAggregationOptions = {
  dropIncompleteBuckets?: boolean;
};

export type FourHourAggregationDiagnostics = {
  totalBuckets: number;
  completeBuckets: number;
  partialBuckets: number;
  droppedPartialBuckets: number;
  gapsDetected: number;
  normalizedInput: CandleContinuityDiagnostics;
};

export type FourHourAggregationResult = {
  fourHourCandles: Candle[];
  diagnostics: FourHourAggregationDiagnostics;
};

const hourMs = getCandleTimeframeDurationMs("1h");
const fourHourMs = getCandleTimeframeDurationMs("4h");
const completeFourHourCandles = 4;

export function aggregateHourlyCandlesToFourHour(
  hourlyCandles: Candle[],
  options: FourHourAggregationOptions = {},
): FourHourAggregationResult {
  const normalized = normalizeCandles(hourlyCandles, "1h");
  const groups = groupHourlyCandlesByFourHourUtcBucket(normalized.candles);
  const dropIncompleteBuckets = options.dropIncompleteBuckets ?? true;
  const fourHourCandles: Candle[] = [];
  let completeBuckets = 0;
  let partialBuckets = 0;
  let droppedPartialBuckets = 0;

  for (const group of groups) {
    const isComplete = isCompleteFourHourBucket(
      group.bucketStartTimeMs,
      group.candles,
    );

    if (isComplete) {
      completeBuckets += 1;
      fourHourCandles.push(
        buildFourHourCandle(group.bucketStartTimeMs, group.candles),
      );
      continue;
    }

    partialBuckets += 1;

    if (dropIncompleteBuckets) {
      droppedPartialBuckets += 1;
      continue;
    }

    fourHourCandles.push(
      buildFourHourCandle(group.bucketStartTimeMs, group.candles),
    );
  }

  return {
    fourHourCandles,
    diagnostics: {
      totalBuckets: groups.length,
      completeBuckets,
      partialBuckets,
      droppedPartialBuckets,
      gapsDetected: normalized.diagnostics.gapCount,
      normalizedInput: normalized.diagnostics,
    },
  };
}

function groupHourlyCandlesByFourHourUtcBucket(candles: Candle[]) {
  const groups = new Map<number, Candle[]>();

  for (const candle of candles) {
    const bucketStartTimeMs = getFourHourUtcBucketStartMs(candle.openTime);
    const group = groups.get(bucketStartTimeMs);

    if (group) {
      group.push(candle);
    } else {
      groups.set(bucketStartTimeMs, [candle]);
    }
  }

  return [...groups.entries()]
    .sort(([leftBucket], [rightBucket]) => leftBucket - rightBucket)
    .map(([bucketStartTimeMs, groupCandles]) => ({
      bucketStartTimeMs,
      candles: groupCandles.sort((left, right) => left.openTime - right.openTime),
    }));
}

function isCompleteFourHourBucket(
  bucketStartTimeMs: number,
  candles: Candle[],
) {
  if (candles.length !== completeFourHourCandles) {
    return false;
  }

  return candles.every(
    (candle, index) => candle.openTime === bucketStartTimeMs + index * hourMs,
  );
}

function buildFourHourCandle(bucketStartTimeMs: number, candles: Candle[]): Candle {
  const firstCandle = candles[0]!;
  const lastCandle = candles.at(-1)!;
  const quoteVolumeValues = candles
    .map((candle) => candle.quoteVolume)
    .filter((quoteVolume): quoteVolume is number => Number.isFinite(quoteVolume));
  const quoteVolume =
    quoteVolumeValues.length > 0
      ? quoteVolumeValues.reduce((total, value) => total + value, 0)
      : undefined;

  return {
    openTime: bucketStartTimeMs,
    open: firstCandle.open,
    high: Math.max(...candles.map((candle) => candle.high)),
    low: Math.min(...candles.map((candle) => candle.low)),
    close: lastCandle.close,
    volume: candles.reduce((total, candle) => total + candle.volume, 0),
    quoteVolume,
    closeTime: bucketStartTimeMs + fourHourMs - 1,
  };
}

export function getFourHourUtcBucketStartMs(timeMs: number) {
  if (!Number.isFinite(timeMs)) {
    throw new Error("timeMs must be a finite timestamp.");
  }

  return Math.floor(timeMs / fourHourMs) * fourHourMs;
}
