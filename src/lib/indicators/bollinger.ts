import { bollingerbands } from "technicalindicators";

export type BollingerPoint = {
  upper: number;
  middle: number;
  lower: number;
  width: number | null;
};

export function calculateBollingerSeries(
  values: number[],
  period = 20,
  stdDev = 2,
): BollingerPoint[] {
  if (values.length < period) {
    return [];
  }

  return bollingerbands({ period, stdDev, values }).map((band) => ({
    upper: band.upper,
    middle: band.middle,
    lower: band.lower,
    width: calculateBandWidth(band.upper, band.middle, band.lower),
  }));
}

export function calculateLatestBollinger(
  values: number[],
  period = 20,
  stdDev = 2,
): BollingerPoint | null {
  return calculateBollingerSeries(values, period, stdDev).at(-1) ?? null;
}

export function calculateBandWidth(
  upper: number | null,
  middle: number | null,
  lower: number | null,
) {
  if (upper === null || middle === null || lower === null || middle === 0) {
    return null;
  }

  return (upper - lower) / middle;
}

export function calculateWidthPercentile(widths: Array<number | null>, lookback = 90) {
  const validWidths = widths.filter((width): width is number => width !== null);
  const currentWidth = validWidths.at(-1);

  if (currentWidth === undefined) {
    return null;
  }

  const recentWidths = validWidths.slice(-lookback);
  // Percentile rank: low values mean the current band width is compressed
  // relative to recent valid widths.
  const lessThanOrEqualCount = recentWidths.filter(
    (width) => width <= currentWidth,
  ).length;

  return (lessThanOrEqualCount / recentWidths.length) * 100;
}
