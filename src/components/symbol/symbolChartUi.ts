export type RawSymbolChartCandle = {
  openTime?: number | string | null;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
};

export type NormalizedSymbolChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SymbolChartLinePoint = {
  time: number;
  value: number;
};

export function normalizeCandlesForChart(
  candles: RawSymbolChartCandle[] | null | undefined,
) {
  const byTime = new Map<number, NormalizedSymbolChartCandle>();

  for (const candle of candles ?? []) {
    const time = normalizeTimestampToSeconds(candle.openTime);
    const open = toFiniteNumber(candle.open);
    const high = toFiniteNumber(candle.high);
    const low = toFiniteNumber(candle.low);
    const close = toFiniteNumber(candle.close);

    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      high < Math.max(open, close) ||
      low > Math.min(open, close)
    ) {
      continue;
    }

    byTime.set(time, { time, open, high, low, close });
  }

  return Array.from(byTime.values()).sort((left, right) => left.time - right.time);
}

export function computeSimpleMovingAverage(
  candles: NormalizedSymbolChartCandle[],
  period: number,
): SymbolChartLinePoint[] {
  if (!Number.isInteger(period) || period <= 0 || candles.length < period) {
    return [];
  }

  const points: SymbolChartLinePoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < candles.length; index += 1) {
    rollingSum += candles[index].close;

    if (index >= period) {
      rollingSum -= candles[index - period].close;
    }

    if (index >= period - 1) {
      points.push({
        time: candles[index].time,
        value: rollingSum / period,
      });
    }
  }

  return points;
}

export function findLatestSignalCandleTime({
  candles,
  candleOpenTime,
}: {
  candles: NormalizedSymbolChartCandle[];
  candleOpenTime: string | number | null | undefined;
}) {
  const signalTime = normalizeTimestampToSeconds(candleOpenTime);

  if (signalTime === null) {
    return null;
  }

  return candles.some((candle) => candle.time === signalTime) ? signalTime : null;
}

export function formatChartPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 6,
  });
}

function normalizeTimestampToSeconds(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rawTime =
    typeof value === "number"
      ? value
      : Number.isFinite(Number(value))
        ? Number(value)
        : new Date(value).getTime();

  if (!Number.isFinite(rawTime) || rawTime <= 0) {
    return null;
  }

  const milliseconds = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;

  return Math.floor(milliseconds / 1000);
}

function toFiniteNumber(value: number | string | null | undefined) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
