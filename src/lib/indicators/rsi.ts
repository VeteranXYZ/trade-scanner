import { rsi } from "technicalindicators";

export function calculateRsiSeries(values: number[], period = 14): number[] {
  if (values.length <= period) {
    return [];
  }

  return rsi({ period, values });
}

export function calculateRsi(values: number[], period = 14): number | null {
  return calculateRsiSeries(values, period).at(-1) ?? null;
}
