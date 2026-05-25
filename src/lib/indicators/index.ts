import type { Candle } from "@/lib/exchanges/types";
import {
  calculateBollingerSeries,
  calculateWidthPercentile,
} from "./bollinger";
import { calculateSma } from "./movingAverage";
import { calculateRsi } from "./rsi";
import type { IndicatorSnapshot } from "./types";
import { calculateVolumeSnapshot } from "./volume";

export function calculateIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  const latest = candles.at(-1);
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);

  const close = latest?.close ?? 0;
  const ma20 = calculateSma(closes, 20);
  const ma50 = calculateSma(closes, 50);
  const ma200 = calculateSma(closes, 200);
  const bollingerSeries = calculateBollingerSeries(closes, 20, 2);
  const latestBollinger = bollingerSeries.at(-1);
  const widthPercentile = calculateWidthPercentile(
    bollingerSeries.map((band) => band.width),
    90,
  );
  const volume = calculateVolumeSnapshot(volumes);

  return {
    close,
    ma20,
    ma50,
    ma200,
    bollinger: {
      upper: latestBollinger?.upper ?? null,
      middle: latestBollinger?.middle ?? null,
      lower: latestBollinger?.lower ?? null,
      width: latestBollinger?.width ?? null,
      widthPercentile,
    },
    rsi14: calculateRsi(closes, 14),
    volume,
    // Keep this as a decimal value; 0.08 means price is 8% above MA20.
    priceExtensionFromMA20:
      ma20 !== null && ma20 !== 0 ? (close - ma20) / ma20 : null,
  };
}

export {
  calculateBandWidth,
  calculateBollingerSeries,
  calculateLatestBollinger,
  calculateWidthPercentile,
} from "./bollinger";
export { calculateSma, calculateSmaSeries } from "./movingAverage";
export { calculateRsi, calculateRsiSeries } from "./rsi";
export { calculateVolumeSnapshot } from "./volume";
export type { IndicatorSnapshot } from "./types";
