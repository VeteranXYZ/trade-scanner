import { macd } from "technicalindicators";

export type MacdSnapshot = {
  line: number | null;
  signal: number | null;
  histogram: number | null;
  histogramRising: boolean;
  bullishCross: boolean;
  bearishCross: boolean;
  aboveZero: boolean;
};

export function calculateMacdSnapshot(values: number[]): MacdSnapshot {
  const series = macd({
    values,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const latest = series.at(-1);
  const previous = series.at(-2);
  const line = latest?.MACD ?? null;
  const signal = latest?.signal ?? null;
  const histogram = latest?.histogram ?? null;

  return {
    line,
    signal,
    histogram,
    histogramRising:
      previous?.histogram !== undefined &&
      histogram !== null &&
      histogram > previous.histogram,
    bullishCross:
      previous?.MACD !== undefined &&
      previous.signal !== undefined &&
      line !== null &&
      signal !== null &&
      previous.MACD <= previous.signal &&
      line > signal,
    bearishCross:
      previous?.MACD !== undefined &&
      previous.signal !== undefined &&
      line !== null &&
      signal !== null &&
      previous.MACD >= previous.signal &&
      line < signal,
    aboveZero: line !== null && line > 0,
  };
}
