import type { Timeframe } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { MarketPhase } from "./types";

type ExplanationInput = {
  phase: MarketPhase;
  snapshot: IndicatorSnapshot;
  sufficientHistory: boolean;
  timeframe: Timeframe;
};

export function getReasons({
  phase,
  snapshot,
  sufficientHistory,
}: ExplanationInput): string[] {
  const reasons: string[] = [];

  if (
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile < 20
  ) {
    reasons.push("Bollinger Band width is in the lower 20% of recent candles.");
  }

  if (areNear(snapshot.ma20, snapshot.ma50, 0.02)) {
    reasons.push("MA20 and MA50 are converging.");
  }

  if (isNear(snapshot.close, snapshot.bollinger.middle, 0.025)) {
    reasons.push("Price is holding near the Bollinger middle band.");
  }

  if (isBetween(snapshot.volume.ratio, 0.6, 1.2)) {
    reasons.push("Volume is quiet, consistent with compression.");
  }

  if (
    snapshot.bollinger.upper !== null &&
    snapshot.close > snapshot.bollinger.upper
  ) {
    reasons.push("Price is above the upper Bollinger Band.");
  }

  if (snapshot.volume.ratio !== null && snapshot.volume.ratio > 1.5) {
    reasons.push("Volume is expanding above its 20-candle average.");
  }

  if (
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 > snapshot.ma50
  ) {
    reasons.push("MA20 is above MA50, supporting short-term trend structure.");
  }

  if (snapshot.ma200 !== null && snapshot.close > snapshot.ma200) {
    reasons.push("Price is above MA200, keeping long-term structure constructive.");
  }

  if (reasons.length === 0 && sufficientHistory) {
    reasons.push(`Current indicators classify the market as ${formatPhase(phase)}.`);
  }

  if (!sufficientHistory) {
    reasons.push("The market has limited candle history, so ranking confidence is lower.");
  }

  return reasons;
}

export function getNextConfirmation({
  phase,
  snapshot,
  timeframe,
}: ExplanationInput): string[] {
  const confirmations: string[] = [];
  const timeframeLabel = timeframe.toUpperCase();

  if (phase === "SQUEEZE" || phase === "BASE_BUILDING") {
    confirmations.push(
      `Watch for a ${timeframeLabel} close above the upper Bollinger Band.`,
    );
    confirmations.push("Volume ratio should rise above 1.5.");
  }

  if (phase === "BREAKOUT_ATTEMPT") {
    confirmations.push("Breakout attempt needs sustained volume above 1.5x average.");
    confirmations.push("RSI should remain below 72 during confirmation.");
  }

  if (phase === "TRENDING" || phase === "PULLBACK_HEALTHY") {
    confirmations.push("Price should remain above MA50.");
    confirmations.push("Pullbacks should hold near MA20 or the Bollinger middle band.");
  }

  if (phase === "OVEREXTENDED") {
    confirmations.push("Risk improves if price consolidates closer to MA20.");
    confirmations.push("RSI should cool below 72 before structure improves.");
  }

  if (phase === "BREAKDOWN" || phase === "DISTRIBUTION") {
    confirmations.push("Structure improves only if price recovers MA50.");
    confirmations.push("Volume should stabilize instead of expanding on declines.");
  }

  if (
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 <= snapshot.ma50
  ) {
    confirmations.push("MA20 should turn above MA50 for stronger trend confirmation.");
  }

  return dedupe(confirmations);
}

export function getInvalidation({ phase, snapshot }: ExplanationInput): string[] {
  const invalidation: string[] = [];

  if (phase === "SQUEEZE" || phase === "BASE_BUILDING") {
    invalidation.push(
      "Invalidated if price loses the Bollinger middle band with rising volume.",
    );
  }

  if (
    phase === "BREAKOUT_ATTEMPT" ||
    phase === "BREAKOUT_CONFIRMED" ||
    phase === "TRENDING"
  ) {
    invalidation.push("Invalidated if price closes back below MA50.");
  }

  if (phase === "PULLBACK_HEALTHY") {
    invalidation.push("Invalidated if the pullback closes below MA50.");
  }

  if (phase === "OVEREXTENDED") {
    invalidation.push("Invalidated if extension resolves into a close below MA20.");
  }

  if (phase === "BREAKDOWN" || phase === "DISTRIBUTION") {
    invalidation.push("Weak structure remains until price recovers MA50.");
  }

  if (snapshot.ma200 !== null) {
    invalidation.push("Long-term structure weakens if price closes below MA200.");
  }

  return dedupe(invalidation);
}

function isBetween(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value <= max;
}

function isNear(value: number, target: number | null, tolerance: number) {
  if (target === null || target === 0) {
    return false;
  }

  return Math.abs(value - target) / Math.abs(target) <= tolerance;
}

function areNear(left: number | null, right: number | null, tolerance: number) {
  if (left === null || right === null || right === 0) {
    return false;
  }

  return Math.abs(left - right) / Math.abs(right) <= tolerance;
}

function formatPhase(phase: MarketPhase) {
  return phase
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dedupe(items: string[]) {
  return Array.from(new Set(items));
}
