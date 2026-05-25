import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";

type RiskWarningInput = {
  snapshot: IndicatorSnapshot;
  candles: Candle[];
  sufficientHistory: boolean;
};

export function getRiskWarnings({
  snapshot,
  candles,
  sufficientHistory,
}: RiskWarningInput): string[] {
  const warnings: string[] = [];
  const latestCandle = candles.at(-1);

  if (snapshot.rsi14 !== null && snapshot.rsi14 > 75) {
    warnings.push("RSI is above 75, which may indicate overextension.");
  }

  if (
    snapshot.bollinger.upper !== null &&
    snapshot.close > snapshot.bollinger.upper &&
    (snapshot.volume.ratio === null || snapshot.volume.ratio < 1.2)
  ) {
    warnings.push(
      "Possible fake breakout: price moved above the upper Bollinger Band without strong volume confirmation.",
    );
  }

  if (
    snapshot.priceExtensionFromMA20 !== null &&
    snapshot.priceExtensionFromMA20 > 0.08
  ) {
    warnings.push("Price is extended from MA20; chasing risk is elevated.");
  }

  if (snapshot.ma50 !== null && snapshot.close < snapshot.ma50) {
    warnings.push("Trend structure is weak because price is below MA50.");
  }

  if (snapshot.ma200 !== null && snapshot.close < snapshot.ma200) {
    warnings.push("Long-term trend remains weak because price is below MA200.");
  }

  if (snapshot.rsi14 !== null && snapshot.rsi14 < 45) {
    warnings.push("RSI is below 45, indicating weak momentum.");
  }

  if (latestCandle && hasLongUpperWick(latestCandle)) {
    warnings.push("The latest candle has a long upper wick, showing supply overhead.");
  }

  if (!sufficientHistory) {
    warnings.push("Candle history is insufficient for the full indicator set.");
  }

  return warnings;
}

function hasLongUpperWick(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return false;
  }

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return upperWick / range > 0.45;
}
