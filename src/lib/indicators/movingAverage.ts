import { sma } from "technicalindicators";

export function calculateSmaSeries(values: number[], period: number): number[] {
  if (!hasEnoughValues(values, period)) {
    return [];
  }

  return sma({ period, values });
}

export function calculateSma(values: number[], period: number): number | null {
  const results = calculateSmaSeries(values, period);
  return results.at(-1) ?? null;
}

function hasEnoughValues(values: number[], period: number) {
  return Number.isInteger(period) && period > 0 && values.length >= period;
}
