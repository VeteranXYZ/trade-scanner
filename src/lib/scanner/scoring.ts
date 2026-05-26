import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type {
  ActionBias,
  DetectedRiskType,
  MarketPhase,
  PrimaryStructure,
  ScanResult,
  ScannerSignalLabel,
  ScannerSignalState,
} from "./types";

export const SCORING_VERSION = "explainable-v1";

type ScoreInput = {
  snapshot: IndicatorSnapshot;
  sufficientHistory: boolean;
  phase?: MarketPhase;
  volume?: ScanResult["volume"];
  candles?: Candle[];
};

export type ScannerRawMetrics = ScanResult["rawMetrics"];

export type ScannerDerivedMetrics = {
  bbPercent: number | null;
  closeAboveMA20: boolean | null;
  closeAboveMA50: boolean | null;
  closeAboveMA200: boolean | null;
  ma20AboveMA50: boolean | null;
  ma50AboveMA200: boolean | null;
  ma20ConvergingMA50: boolean;
  ma20NearCrossAboveMA50: boolean;
  ma20FlatteningOrDown: boolean;
  macdState: "strong" | "improving" | "flat" | "weakening" | "weak" | null;
  volumeRatio: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
  closePositionInCandle: number | null;
  bodyRatio: number | null;
  isVolumeSpike: boolean | null;
  isStrongClose: boolean | null;
  isWeakClose: boolean | null;
  isLongUpperWick: boolean | null;
  isLongLowerWick: boolean | null;
  isRedCandle: boolean | null;
  isPriceExtendedAboveMA20: boolean;
  isNearMA50: boolean;
  isAboveRecentHigh: boolean;
  failedBreakout: boolean;
};

export type ScannerScores = {
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  structureScore: number;
  finalSignalScore: number;
  rankScore: number;
};

type StructureDiagnosis = {
  primaryStructure: PrimaryStructure;
  secondaryStructures: string[];
};

type SignalClassification = {
  signalLabel: ScannerSignalLabel;
  actionBias: ActionBias;
};

export type ScannerScoreResult = ScannerScores &
  StructureDiagnosis &
  SignalClassification & {
    detectedRiskTypes: DetectedRiskType[];
    bullishFactors: string[];
    bearishFactors: string[];
    riskFactors: string[];
    neutralFactors: string[];
    nextConfirmationText: string[];
    invalidationText: string[];
    rawMetrics: ScannerRawMetrics;
  };

export function calculateScannerScores(input: ScoreInput): ScannerScoreResult {
  const derived = buildDerivedMetrics(input);
  const rawMetrics = buildRawMetrics(input.snapshot, derived);
  const trendScore = calculateTrendScore(rawMetrics);
  const momentumScore = calculateMomentumScore(rawMetrics);
  const volumeScore = calculateVolumeScore(rawMetrics, input.phase);
  const opportunityScore = calculateOpportunityScore(
    rawMetrics,
    derived,
    input.sufficientHistory,
    input.phase,
  );
  const confirmationScore = calculateConfirmationScore(rawMetrics, derived);
  const riskScore = calculateRiskScore(
    rawMetrics,
    derived,
    input.sufficientHistory,
    input.phase,
  );
  const provisionalScores = {
    opportunityScore,
    confirmationScore,
    riskScore,
    trendScore,
    momentumScore,
    volumeScore,
  };
  const detectedRiskTypes = detectRiskTypes(
    rawMetrics,
    provisionalScores,
    derived,
    input.phase,
  );
  const structure = classifyStructure(
    rawMetrics,
    provisionalScores,
    derived,
    detectedRiskTypes,
    input.phase,
  );
  const structureScore = calculateStructureScore(
    provisionalScores,
    structure,
    detectedRiskTypes,
  );
  const scores = {
    ...provisionalScores,
    structureScore,
    finalSignalScore: calculateFinalSignalScore(provisionalScores),
  };
  const signal = classifySignal(scores, structure, detectedRiskTypes, rawMetrics);
  const explanation = explainScore({
    rawMetrics,
    scores,
    structure,
    detectedRiskTypes,
    derived,
  });

  return {
    ...scores,
    // Legacy compatibility: rankScore remains the sortable composite score.
    rankScore: scores.finalSignalScore,
    ...structure,
    ...signal,
    detectedRiskTypes,
    ...explanation,
    rawMetrics,
  };
}

export function calculateTrendScore(metrics: ScannerRawMetrics) {
  let score = 0;

  if (metrics.closeAboveMA20 === true) score += 15;
  if (metrics.closeAboveMA20 === false) score -= 15;
  if (metrics.closeAboveMA50 === true) score += 20;
  if (metrics.closeAboveMA50 === false) score -= 25;
  if (metrics.closeAboveMA200 === true) score += 25;
  if (metrics.closeAboveMA200 === false) score -= 35;
  if (metrics.ma20AboveMA50 === true) score += 25;
  if (metrics.ma20AboveMA50 === false) score -= 25;
  if (metrics.ma50AboveMA200 === true) score += 25;
  if (metrics.ma50AboveMA200 === false) score -= 25;

  if (
    metrics.ma20AboveMA50 === true &&
    metrics.ma50AboveMA200 === true &&
    metrics.closeAboveMA20 === true
  ) {
    score += 25;
  }

  return score;
}

export function calculateMomentumScore(metrics: ScannerRawMetrics) {
  let score = 0;

  if (isBetween(metrics.rsi, 50, 65)) score += 25;
  else if (isBetween(metrics.rsi, 65, 72)) score += 15;
  else if (isBetween(metrics.rsi, 72, 80)) score += 5;
  else if (metrics.rsi !== null && metrics.rsi > 80) score -= 10;
  else if (isBetween(metrics.rsi, 40, 50)) score -= 10;
  else if (metrics.rsi !== null && metrics.rsi < 40) score -= 30;

  switch (metrics.macdState) {
    case "strong":
      score += 25;
      break;
    case "improving":
      score += 20;
      break;
    case "weakening":
      score -= 20;
      break;
    case "weak":
      score -= 35;
      break;
  }

  if (isBetween(metrics.bbPercent, 40, 75)) score += 10;
  else if (isBetween(metrics.bbPercent, 75, 90)) score += 15;
  else if (metrics.bbPercent !== null && metrics.bbPercent < 20) score -= 10;

  return score;
}

export function calculateVolumeScore(
  metrics: ScannerRawMetrics,
  phase?: MarketPhase,
) {
  let score = 0;

  if (metrics.volumeRatio !== null && metrics.volumeRatio > 1) {
    if (metrics.isStrongClose) score += 25;
    if (
      metrics.volumeRatio >= 1.5 &&
      (phase === "BREAKOUT_ATTEMPT" || phase === "BREAKOUT_CONFIRMED")
    ) {
      score += 35;
    }
    if (!metrics.isLongUpperWick) score += 15;
    if (
      metrics.volumeRatio <= 1.8 &&
      (metrics.closeAboveMA20 || metrics.closeAboveMA50)
    ) {
      score += 15;
    }
  }

  if (metrics.isVolumeSpike && metrics.isLongUpperWick) score -= 25;
  if (metrics.isVolumeSpike && !metrics.isStrongClose) score -= 20;
  if (metrics.isVolumeSpike && metrics.isWeakClose) score -= 35;
  if (metrics.isRedCandle && metrics.volumeRatio !== null && metrics.volumeRatio > 1.5) {
    score -= 25;
  }
  if (
    metrics.isVolumeSpike &&
    metrics.bbPercent !== null &&
    metrics.bbPercent < 75 &&
    metrics.closeAboveMA50 !== true
  ) {
    score -= 15;
  }

  return score;
}

export function calculateOpportunityScore(
  metrics: ScannerRawMetrics,
  derived: ScannerDerivedMetrics,
  sufficientHistory: boolean,
  phase?: MarketPhase,
) {
  let score = 0;

  if (metrics.closeAboveMA20 === true) score += 20;
  if (derived.isNearMA50) score += 15;
  if (metrics.closeAboveMA50 === true) score += 25;
  if (derived.ma20ConvergingMA50) score += 15;
  if (derived.ma20NearCrossAboveMA50) score += 20;
  if (metrics.rsi !== null && metrics.rsi >= 48 && metrics.rsi < 50) score += 10;
  if (isBetween(metrics.rsi, 50, 65)) score += 25;
  if (
    metrics.volumeRatio !== null &&
    metrics.volumeRatio >= 1.1 &&
    metrics.volumeRatio <= 1.8
  ) {
    score += 15;
  }
  if (derived.isAboveRecentHigh) score += 20;
  if (metrics.bbPercent !== null && metrics.bbPercent >= 45 && metrics.bbPercent <= 90) {
    score += 10;
  }
  if (metrics.bbPercent !== null && metrics.bbPercent > 90) score += 5;
  if (metrics.macdState === "flat" || metrics.macdState === "improving") {
    score += 15;
  }
  if (
    phase === "PULLBACK_HEALTHY" &&
    metrics.closeAboveMA20 === true &&
    metrics.isWeakClose !== true
  ) {
    score += 15;
  }
  if (
    (phase === "BREAKOUT_ATTEMPT" || phase === "BREAKOUT_CONFIRMED") &&
    metrics.closeAboveMA20 === true
  ) {
    score += 15;
  }

  if (metrics.closeAboveMA50 === false && metrics.closeAboveMA200 === false) score -= 35;
  if (metrics.rsi !== null && metrics.rsi < 40) score -= 25;
  if (metrics.macdState === "weak") score -= 25;
  if (metrics.isVolumeSpike && metrics.isWeakClose) score -= 20;
  if (metrics.isLongUpperWick) score -= 15;
  if (derived.isPriceExtendedAboveMA20 || metrics.rsi !== null && metrics.rsi > 80) {
    score -= 20;
  }
  if (!sufficientHistory) score -= 10;

  return score;
}

export function calculateConfirmationScore(
  metrics: ScannerRawMetrics,
  derived: ScannerDerivedMetrics,
) {
  let score = 0;

  if (metrics.closeAboveMA20 === true) score += 15;
  if (metrics.closeAboveMA20 === false) score -= 20;
  if (metrics.closeAboveMA50 === true) score += 20;
  if (metrics.closeAboveMA50 === false) score -= 25;
  if (metrics.closeAboveMA200 === true) score += 20;
  if (metrics.closeAboveMA200 === false) score -= 30;
  if (metrics.ma20AboveMA50 === true) score += 20;
  if (metrics.ma20AboveMA50 === false) score -= 20;
  if (metrics.ma50AboveMA200 === true) score += 20;
  if (
    metrics.ma20AboveMA50 === true &&
    metrics.ma50AboveMA200 === true &&
    metrics.closeAboveMA20 === true
  ) {
    score += 25;
  }
  if (metrics.macdState === "improving") score += 20;
  if (metrics.macdState === "strong") score += 25;
  if (isBetween(metrics.rsi, 50, 68)) score += 20;
  if (metrics.isLongUpperWick === false) score += 10;
  if (metrics.isStrongClose) score += 15;
  if (
    metrics.volumeRatio !== null &&
    metrics.volumeRatio > 1 &&
    metrics.isStrongClose &&
    metrics.isLongUpperWick === false
  ) {
    score += 15;
  }
  if (
    metrics.volumeRatio !== null &&
    metrics.volumeRatio > 1.5 &&
    metrics.closeAboveMA20 === true
  ) {
    score += 10;
  }
  if (metrics.closeAboveMA20 === true && !derived.failedBreakout) score += 10;

  if (metrics.rsi !== null && metrics.rsi < 45) score -= 20;
  if (metrics.macdState === "weakening") score -= 20;
  if (metrics.macdState === "weak") score -= 35;
  if (derived.failedBreakout) score -= 30;
  if (metrics.isVolumeSpike && metrics.isWeakClose) score -= 30;
  if (metrics.isLongUpperWick) score -= 20;

  return score;
}

export function calculateRiskScore(
  metrics: ScannerRawMetrics,
  derived: ScannerDerivedMetrics,
  sufficientHistory: boolean,
  phase?: MarketPhase,
) {
  let score = 0;

  if (metrics.rsi !== null && metrics.rsi > 70) score += 25;
  if (metrics.rsi !== null && metrics.rsi > 80) score += 40;
  if (metrics.bbPercent !== null && metrics.bbPercent > 90) score += 20;
  if (metrics.bbPercent !== null && metrics.bbPercent > 98) score += 40;
  if (derived.isPriceExtendedAboveMA20) score += 25;
  if (metrics.isVolumeSpike && (metrics.rsi ?? 0) > 65) score += 25;
  if (metrics.isLongUpperWick) score += 35;
  if (metrics.isVolumeSpike && !metrics.isStrongClose) score += 40;
  if (metrics.isVolumeSpike && metrics.isWeakClose) score += 60;
  if (metrics.closeAboveMA50 === false) score += 25;
  if (metrics.closeAboveMA200 === false) score += 35;
  if (metrics.macdState === "weakening") score += 25;
  if (metrics.macdState === "weak") score += 40;
  if (metrics.isVolumeSpike && !derived.isAboveRecentHigh) score += 35;
  if (metrics.isWeakClose) score += 20;
  if (derived.failedBreakout) score += 50;
  if (metrics.closeAboveMA20 === false && phase === "BREAKOUT_CONFIRMED") {
    score += 35;
  }
  if (derived.ma20FlatteningOrDown) score += 20;
  if (derived.ma20NearCrossAboveMA50 && metrics.ma20AboveMA50 === false) score += 20;
  if (metrics.isRedCandle && metrics.volumeRatio !== null && metrics.volumeRatio > 1.5) {
    score += 35;
  }
  if (phase === "BREAKDOWN" && metrics.volumeRatio !== null && metrics.volumeRatio > 1.5) {
    score += 20;
  }
  if (metrics.volumeRatio !== null && metrics.volumeRatio >= 5) score += 40;
  if (!sufficientHistory) score += 10;
  if (phase === "OVEREXTENDED") score += 25;
  if (phase === "DISTRIBUTION") score += 45;
  if (phase === "BREAKDOWN") score += 40;

  return score;
}

export function detectRiskTypes(
  metrics: ScannerRawMetrics,
  scores: Pick<
    ScannerScores,
    | "opportunityScore"
    | "confirmationScore"
    | "riskScore"
    | "trendScore"
    | "momentumScore"
    | "volumeScore"
  >,
  derived: ScannerDerivedMetrics,
  phase?: MarketPhase,
): DetectedRiskType[] {
  const riskTypes: DetectedRiskType[] = [];

  if (
    (metrics.rsi !== null && metrics.rsi > 70) ||
    (metrics.bbPercent !== null && metrics.bbPercent > 90) ||
    derived.isPriceExtendedAboveMA20 ||
    (metrics.isVolumeSpike && scores.riskScore >= 70)
  ) {
    riskTypes.push("overheat_risk");
  }

  if (
    phase === "DISTRIBUTION" ||
    (metrics.isVolumeSpike && metrics.isLongUpperWick) ||
    (metrics.isVolumeSpike && metrics.isWeakClose) ||
    (derived.failedBreakout && metrics.isVolumeSpike)
  ) {
    riskTypes.push("distribution_risk");
  }

  if (
    metrics.closeAboveMA50 === false &&
    metrics.closeAboveMA200 === false &&
    (metrics.rsi === null || metrics.rsi < 50) &&
    (metrics.macdState === "weakening" || metrics.macdState === "weak") &&
    (metrics.bbPercent === null || metrics.bbPercent >= 70 || scores.trendScore < 0)
  ) {
    riskTypes.push("weak_bounce_risk");
  }

  if (
    phase === "BREAKDOWN" ||
    (metrics.closeAboveMA20 === false &&
      (derived.ma20FlatteningOrDown ||
        metrics.macdState === "weakening" ||
        metrics.macdState === "weak" ||
        (metrics.isRedCandle && (metrics.volumeRatio ?? 0) > 1.5)))
  ) {
    riskTypes.push("trend_breakdown_risk");
  }

  if (
    metrics.volumeRatio !== null &&
    metrics.volumeRatio >= 5 &&
    (metrics.isLongUpperWick === true ||
      !derived.isAboveRecentHigh ||
      metrics.bodyRatio === null ||
      metrics.bodyRatio === undefined ||
      metrics.bodyRatio < 0.35)
  ) {
    riskTypes.push("liquidity_spike_risk");
  }

  if (derived.failedBreakout) {
    riskTypes.push("failed_breakout_risk");
  }

  return dedupe(riskTypes);
}

export function classifyStructure(
  metrics: ScannerRawMetrics,
  scores: Pick<
    ScannerScores,
    | "opportunityScore"
    | "confirmationScore"
    | "riskScore"
    | "trendScore"
    | "momentumScore"
    | "volumeScore"
  >,
  derived: ScannerDerivedMetrics,
  riskTypes: DetectedRiskType[],
  phase?: MarketPhase,
): StructureDiagnosis {
  const secondaryStructures: string[] = [];

  if (metrics.closeAboveMA50 === false) secondaryStructures.push("below_ma50");
  if (metrics.closeAboveMA200 === false) secondaryStructures.push("below_ma200");
  if (metrics.closeAboveMA20 === true) secondaryStructures.push("above_ma20");
  if (derived.ma20ConvergingMA50) {
    secondaryStructures.push("ma20_converging_ma50");
  }
  if (metrics.bbPercent !== null && metrics.bbPercent > 90) {
    secondaryStructures.push("high_bb_percent");
  }
  if (metrics.rsi !== null && metrics.rsi > 70) secondaryStructures.push("high_rsi");
  if (metrics.isVolumeSpike) secondaryStructures.push("volume_spike");
  if (metrics.isLongUpperWick) secondaryStructures.push("long_upper_wick");
  if (metrics.macdState === "weakening") secondaryStructures.push("macd_weakening");
  if (derived.failedBreakout) secondaryStructures.push("failed_breakout");
  if (metrics.isStrongClose) secondaryStructures.push("close_near_high");
  if (metrics.isWeakClose) secondaryStructures.push("close_near_low");
  if (metrics.ma20AboveMA50 && metrics.ma50AboveMA200) {
    secondaryStructures.push("trend_aligned");
  } else if (
    metrics.closeAboveMA20 !== null ||
    metrics.closeAboveMA50 !== null ||
    metrics.closeAboveMA200 !== null
  ) {
    secondaryStructures.push("trend_mixed");
  }

  let primaryStructure: PrimaryStructure = "neutral";

  if (riskTypes.includes("distribution_risk")) {
    primaryStructure = "distribution_risk";
  } else if (riskTypes.includes("trend_breakdown_risk")) {
    primaryStructure = "trend_breakdown";
  } else if (riskTypes.includes("weak_bounce_risk")) {
    primaryStructure = "weak_bounce";
  } else if (riskTypes.includes("overheat_risk") && scores.riskScore >= 80) {
    primaryStructure = "overextended";
  } else if (scores.trendScore >= 90 && scores.confirmationScore >= 70) {
    primaryStructure = "strong_trend";
  } else if (phase === "PULLBACK_HEALTHY") {
    primaryStructure = "healthy_pullback";
  } else if (
    phase === "BREAKOUT_ATTEMPT" ||
    derived.isAboveRecentHigh ||
    (metrics.closeAboveMA20 === true && metrics.closeAboveMA50 !== true)
  ) {
    primaryStructure = "breakout_attempt";
  } else if (
    scores.opportunityScore > 0 &&
    scores.confirmationScore < 70 &&
    scores.riskScore < 90
  ) {
    primaryStructure = "trend_repair";
  }

  return {
    primaryStructure,
    secondaryStructures: dedupe(secondaryStructures),
  };
}

export function classifySignal(
  scores: Omit<ScannerScores, "rankScore">,
  structure: StructureDiagnosis,
  riskTypes: DetectedRiskType[],
  metrics: ScannerRawMetrics,
): SignalClassification {
  if (riskTypes.includes("distribution_risk")) {
    return { signalLabel: "distribution_risk", actionBias: "avoid" };
  }

  if (riskTypes.includes("trend_breakdown_risk")) {
    return { signalLabel: "breakdown_risk", actionBias: "avoid" };
  }

  if (riskTypes.includes("failed_breakout_risk")) {
    return { signalLabel: "distribution_risk", actionBias: "avoid" };
  }

  if (riskTypes.includes("weak_bounce_risk")) {
    return {
      signalLabel: "weak_bounce",
      actionBias: scores.riskScore >= 100 ? "avoid" : "watch_only",
    };
  }

  if (riskTypes.includes("overheat_risk") && scores.riskScore >= 70) {
    return { signalLabel: "overheated", actionBias: "do_not_chase" };
  }

  if (
    scores.confirmationScore >= 60 &&
    scores.trendScore > 0 &&
    scores.riskScore < 70 &&
    metrics.closeAboveMA50 === true &&
    !riskTypes.includes("distribution_risk") &&
    !riskTypes.includes("trend_breakdown_risk") &&
    !riskTypes.includes("failed_breakout_risk") &&
    (metrics.rsi === null || metrics.rsi < 72) &&
    metrics.isWeakClose !== true
  ) {
    return { signalLabel: "confirmed", actionBias: "eligible" };
  }

  if (
    scores.opportunityScore > 0 &&
    (scores.confirmationScore < 90 || metrics.closeAboveMA50 !== true) &&
    scores.riskScore < 90 &&
    metrics.closeAboveMA20 === true &&
    (structure.primaryStructure === "trend_repair" ||
      structure.primaryStructure === "breakout_attempt" ||
      structure.primaryStructure === "healthy_pullback")
  ) {
    return { signalLabel: "watch", actionBias: "watch_only" };
  }

  if (scores.trendScore >= 80 && scores.confirmationScore >= 50 && scores.riskScore < 90) {
    return {
      signalLabel: "trend",
      actionBias: scores.confirmationScore >= 70 ? "eligible" : "watch_only",
    };
  }

  if (
    scores.trendScore < 0 &&
    scores.momentumScore < 0 &&
    scores.confirmationScore < 0 &&
    scores.opportunityScore <= 0
  ) {
    return { signalLabel: "weak", actionBias: "ignore" };
  }

  return { signalLabel: "neutral", actionBias: "ignore" };
}

export function calculateFinalSignalScore(
  scores: Pick<
    ScannerScores,
    | "opportunityScore"
    | "confirmationScore"
    | "riskScore"
    | "trendScore"
    | "momentumScore"
    | "volumeScore"
  >,
) {
  return (
    scores.opportunityScore * 0.35 +
    scores.confirmationScore * 0.35 +
    scores.trendScore * 0.25 +
    scores.momentumScore * 0.2 +
    scores.volumeScore * 0.15 -
    scores.riskScore * 0.45
  );
}

export function calculateStructureScore(
  scores: Pick<
    ScannerScores,
    "trendScore" | "momentumScore" | "volumeScore" | "riskScore"
  >,
  structure: StructureDiagnosis,
  riskTypes: DetectedRiskType[],
) {
  const structureAdjustment: Record<PrimaryStructure, number> = {
    strong_trend: 30,
    healthy_pullback: 20,
    trend_repair: 10,
    breakout_attempt: 10,
    overextended: -10,
    distribution_risk: -35,
    weak_bounce: -25,
    trend_breakdown: -40,
    neutral: 0,
  };

  return (
    scores.trendScore * 0.55 +
    scores.momentumScore * 0.25 +
    scores.volumeScore * 0.2 -
    scores.riskScore * 0.25 +
    structureAdjustment[structure.primaryStructure] -
    riskTypes.length * 5
  );
}

export function explainScore({
  rawMetrics: metrics,
  scores,
  structure,
  detectedRiskTypes,
  derived,
}: {
  rawMetrics: ScannerRawMetrics;
  scores: Omit<ScannerScores, "rankScore">;
  structure: StructureDiagnosis;
  detectedRiskTypes: DetectedRiskType[];
  derived: ScannerDerivedMetrics;
}) {
  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];
  const riskFactors: string[] = [];
  const neutralFactors: string[] = [];
  const nextConfirmationText: string[] = [];
  const invalidationText: string[] = [];

  if (metrics.closeAboveMA20 === true) bullishFactors.push("价格重新站上 MA20。");
  if (metrics.closeAboveMA50 === true) bullishFactors.push("价格位于 MA50 上方。");
  if (metrics.closeAboveMA200 === true) bullishFactors.push("价格位于 MA200 上方。");
  if (metrics.ma20AboveMA50 === true) bullishFactors.push("MA20 位于 MA50 上方。");
  if (metrics.ma50AboveMA200 === true) bullishFactors.push("MA50 位于 MA200 上方。");
  if (isBetween(metrics.rsi, 50, 65)) {
    bullishFactors.push("RSI 位于 50-65 的健康修复区。");
  }
  if (metrics.macdState === "improving") {
    bullishFactors.push("MACD 动能正在改善。");
  }
  if (metrics.macdState === "strong") bullishFactors.push("MACD 结构偏强。");
  if (metrics.isStrongClose) bullishFactors.push("最新 K 线收盘位置偏强。");
  if (scores.volumeScore > 0) bullishFactors.push("成交量对当前上行结构有支持。");

  if (metrics.closeAboveMA20 === false) bearishFactors.push("价格低于 MA20。");
  if (metrics.closeAboveMA50 === false) bearishFactors.push("价格仍低于 MA50。");
  if (metrics.closeAboveMA200 === false) {
    bearishFactors.push("价格仍低于 MA200，长期趋势结构未修复。");
  }
  if (metrics.ma20AboveMA50 === false) bearishFactors.push("MA20 仍低于 MA50。");
  if (metrics.rsi !== null && metrics.rsi < 45) {
    bearishFactors.push("RSI 低于 45，动量仍偏弱。");
  }
  if (metrics.macdState === "weakening") bearishFactors.push("MACD 正在转弱。");
  if (metrics.macdState === "weak") bearishFactors.push("MACD 处于弱势状态。");

  if (detectedRiskTypes.includes("overheat_risk")) {
    riskFactors.push("RSI、BB% 或价格相对 MA20 的延伸显示短线过热风险。");
  }
  if (detectedRiskTypes.includes("distribution_risk")) {
    riskFactors.push("成交量放大且收盘或影线质量偏弱，需要区分承接和派发。");
  }
  if (detectedRiskTypes.includes("weak_bounce_risk")) {
    riskFactors.push("价格仍在关键均线下方反弹，结构尚未完成趋势修复。");
  }
  if (detectedRiskTypes.includes("trend_breakdown_risk")) {
    riskFactors.push("价格或动量跌破关键趋势条件，存在趋势破坏风险。");
  }
  if (detectedRiskTypes.includes("liquidity_spike_risk")) {
    riskFactors.push("成交量异常放大但价格结构未同步确认，存在流动性冲击风险。");
  }
  if (detectedRiskTypes.includes("failed_breakout_risk")) {
    riskFactors.push("突破后未能维持在关键区域上方，存在假突破风险。");
  }
  if (metrics.isLongUpperWick) riskFactors.push("最新 K 线存在较长上影线。");
  if (metrics.isWeakClose) riskFactors.push("最新 K 线收盘位置偏弱。");
  if (metrics.volumeRatio !== null && metrics.volumeRatio > 3) {
    riskFactors.push("成交量显著高于 20 周期均量。");
  }

  if (metrics.macdState === "flat") neutralFactors.push("MACD 当前偏平。");
  if (metrics.volumeRatio !== null && isBetween(metrics.volumeRatio, 0.8, 1.2)) {
    neutralFactors.push("成交量接近 20 周期均量。");
  }
  if (metrics.rsi === null) neutralFactors.push("RSI 数据不足。");
  if (metrics.bbPercent === null) neutralFactors.push("BB% 数据不足。");

  if (metrics.closeAboveMA50 !== true) {
    nextConfirmationText.push("价格需要重新收复 MA50。");
  }
  if (metrics.ma20AboveMA50 !== true) {
    nextConfirmationText.push("MA20 需要继续上行并接近或上穿 MA50。");
  }
  if (metrics.rsi !== null && metrics.rsi < 50) {
    nextConfirmationText.push("RSI 需要重新回到 50 上方。");
  }
  if (structure.primaryStructure === "breakout_attempt" || derived.failedBreakout) {
    nextConfirmationText.push("突破位需要在下一根 K 线继续守住。");
    nextConfirmationText.push("下一根 K 线需要收在前高上方。");
  }
  if (metrics.volumeRatio !== null && metrics.volumeRatio > 1.8) {
    nextConfirmationText.push("回踩时成交量应保持稳定，而不是继续放大。");
  }
  if (metrics.closeAboveMA20 === true) {
    invalidationText.push("如果价格重新跌破 MA20，当前修复结构失效。");
  }
  invalidationText.push("如果阴线继续放量，风险权重应提高。");
  if (metrics.closeAboveMA50 !== true) {
    invalidationText.push("如果价格无法重新收复 MA50，趋势修复仍不成立。");
  }
  if (metrics.macdState === "weakening" || metrics.macdState === "weak") {
    invalidationText.push("如果 MACD 继续转弱，确认分应下调。");
  }
  if (derived.failedBreakout) {
    invalidationText.push("如果价格继续跌回突破位下方，突破结构失效。");
  }
  if (scores.riskScore > 70) {
    invalidationText.push("如果风险分继续上升且确认分下降，应优先按风险结构处理。");
  }

  return {
    bullishFactors: dedupe(bullishFactors),
    bearishFactors: dedupe(bearishFactors),
    riskFactors: dedupe(riskFactors),
    neutralFactors: dedupe(neutralFactors),
    nextConfirmationText: dedupe(nextConfirmationText),
    invalidationText: dedupe(invalidationText),
  };
}

export function mapSignalLabelToChinese(signalLabel: ScannerSignalLabel) {
  const labels: Record<ScannerSignalLabel, string> = {
    confirmed: "确认",
    watch: "观察",
    trend: "趋势",
    overheated: "过热",
    distribution_risk: "派发风险",
    weak_bounce: "弱反弹",
    breakdown_risk: "破坏风险",
    weak: "弱势",
    neutral: "中性",
  };

  return labels[signalLabel];
}

export function mapActionBiasToChinese(actionBias: ActionBias) {
  const labels: Record<ActionBias, string> = {
    eligible: "可进入候选",
    watch_only: "仅观察",
    do_not_chase: "不追高",
    avoid: "回避",
    ignore: "忽略",
  };

  return labels[actionBias];
}

export function mapStructureToChinese(primaryStructure: PrimaryStructure) {
  const labels: Record<PrimaryStructure, string> = {
    strong_trend: "强趋势",
    healthy_pullback: "健康回踩",
    trend_repair: "趋势修复",
    breakout_attempt: "突破尝试",
    overextended: "过度延伸",
    distribution_risk: "派发风险",
    weak_bounce: "弱势反弹",
    trend_breakdown: "趋势破坏",
    neutral: "中性",
  };

  return labels[primaryStructure];
}

export function mapRiskTypeToChinese(riskType: DetectedRiskType) {
  const labels: Record<DetectedRiskType, string> = {
    overheat_risk: "过热风险",
    distribution_risk: "派发风险",
    weak_bounce_risk: "弱势反弹风险",
    trend_breakdown_risk: "趋势破坏风险",
    liquidity_spike_risk: "流动性异常风险",
    failed_breakout_risk: "假突破风险",
  };

  return labels[riskType];
}

export function mapSignalLabelToLegacyState(
  signalLabel: ScannerSignalLabel,
): ScannerSignalState {
  switch (signalLabel) {
    case "confirmed":
      return "CONFIRMED";
    case "watch":
      return "WATCHLIST";
    case "trend":
      return "TREND_CONTINUATION";
    case "overheated":
    case "distribution_risk":
    case "breakdown_risk":
      return "HIGH_RISK";
    case "weak_bounce":
    case "weak":
      return "WEAK";
    case "neutral":
      return "NEUTRAL";
  }
}

export function buildLegacySignal(
  signalLabel: ScannerSignalLabel,
  actionBias: ActionBias,
) {
  const state = mapSignalLabelToLegacyState(signalLabel);

  return {
    state,
    label: mapSignalLabelToChinese(signalLabel),
    summary: `${mapSignalLabelToChinese(signalLabel)} / ${mapActionBiasToChinese(
      actionBias,
    )}`,
  };
}

export function clampScore(value: number) {
  return value;
}

function buildDerivedMetrics({
  snapshot,
  candles,
  volume,
}: ScoreInput): ScannerDerivedMetrics {
  const latestCandle = candles?.at(-1);
  const previousCandle = candles?.at(-2);
  const recentCandles = candles?.slice(-21, -1) ?? [];
  const recentHigh =
    recentCandles.length > 0
      ? Math.max(...recentCandles.map((candle) => candle.high))
      : null;
  const previousHigh = previousCandle?.high ?? recentHigh;
  const bbPercent = getBollingerPercent(snapshot);
  const volumeRatio = volume?.ratio20 ?? snapshot.volume.ratio20;
  const candleQuality = getCandleQuality(latestCandle, volumeRatio);
  const closeAboveMA20 =
    snapshot.ma20 === null ? null : snapshot.close > snapshot.ma20;
  const closeAboveMA50 =
    snapshot.ma50 === null ? null : snapshot.close > snapshot.ma50;
  const closeAboveMA200 =
    snapshot.ma200 === null ? null : snapshot.close > snapshot.ma200;
  const ma20AboveMA50 =
    snapshot.ma20 === null || snapshot.ma50 === null
      ? null
      : snapshot.ma20 > snapshot.ma50;
  const ma50AboveMA200 =
    snapshot.ma50 === null || snapshot.ma200 === null
      ? null
      : snapshot.ma50 > snapshot.ma200;
  const ma20ConvergingMA50 = areNear(snapshot.ma20, snapshot.ma50, 0.03);
  const ma20NearCrossAboveMA50 =
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 <= snapshot.ma50 &&
    (snapshot.ma50 - snapshot.ma20) / snapshot.ma50 <= 0.025;
  const ma20FlatteningOrDown =
    snapshot.ma20 !== null &&
    previousCandle !== undefined &&
    latestCandle !== undefined &&
    latestCandle.close <= previousCandle.close &&
    closeAboveMA20 === false;
  const isAboveRecentHigh = recentHigh !== null && snapshot.close > recentHigh;
  const failedBreakout =
    previousHigh !== null &&
    latestCandle !== undefined &&
    latestCandle.high > previousHigh &&
    latestCandle.close < previousHigh &&
    (candleQuality.isLongUpperWick === true ||
      candleQuality.isWeakClose === true);

  return {
    bbPercent,
    closeAboveMA20,
    closeAboveMA50,
    closeAboveMA200,
    ma20AboveMA50,
    ma50AboveMA200,
    ma20ConvergingMA50,
    ma20NearCrossAboveMA50,
    ma20FlatteningOrDown,
    macdState: getMacdState(snapshot),
    volumeRatio,
    ...candleQuality,
    isPriceExtendedAboveMA20:
      snapshot.priceExtensionFromMA20 !== null &&
      snapshot.priceExtensionFromMA20 > 0.08,
    isNearMA50: isNear(snapshot.close, snapshot.ma50, 0.025),
    isAboveRecentHigh,
    failedBreakout,
  };
}

function buildRawMetrics(
  snapshot: IndicatorSnapshot,
  derived: ScannerDerivedMetrics,
): ScannerRawMetrics {
  return {
    price: snapshot.close,
    rsi: snapshot.rsi14,
    bbPercent: derived.bbPercent,
    volumeRatio: derived.volumeRatio,
    macdState: derived.macdState,
    closeAboveMA20: derived.closeAboveMA20,
    closeAboveMA50: derived.closeAboveMA50,
    closeAboveMA200: derived.closeAboveMA200,
    ma20AboveMA50: derived.ma20AboveMA50,
    ma50AboveMA200: derived.ma50AboveMA200,
    ma20: snapshot.ma20,
    ma50: snapshot.ma50,
    ma200: snapshot.ma200,
    upperWickRatio: derived.upperWickRatio,
    lowerWickRatio: derived.lowerWickRatio,
    closePositionInCandle: derived.closePositionInCandle,
    bodyRatio: derived.bodyRatio,
    isVolumeSpike: derived.isVolumeSpike,
    isStrongClose: derived.isStrongClose,
    isWeakClose: derived.isWeakClose,
    isLongUpperWick: derived.isLongUpperWick,
    isLongLowerWick: derived.isLongLowerWick,
    isRedCandle: derived.isRedCandle,
  };
}

function getCandleQuality(
  candle: Candle | undefined,
  volumeRatio: number | null,
): Pick<
  ScannerDerivedMetrics,
  | "upperWickRatio"
  | "lowerWickRatio"
  | "closePositionInCandle"
  | "bodyRatio"
  | "isVolumeSpike"
  | "isStrongClose"
  | "isWeakClose"
  | "isLongUpperWick"
  | "isLongLowerWick"
  | "isRedCandle"
> {
  if (!candle) {
    return {
      upperWickRatio: null,
      lowerWickRatio: null,
      closePositionInCandle: null,
      bodyRatio: null,
      isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
      isStrongClose: null,
      isWeakClose: null,
      isLongUpperWick: null,
      isLongLowerWick: null,
      isRedCandle: null,
    };
  }

  const range = candle.high - candle.low;

  if (range <= 0) {
    return {
      upperWickRatio: 0,
      lowerWickRatio: 0,
      closePositionInCandle: null,
      bodyRatio: 0,
      isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
      isStrongClose: null,
      isWeakClose: null,
      isLongUpperWick: false,
      isLongLowerWick: false,
      isRedCandle: candle.close < candle.open,
    };
  }

  const upperWickRatio = (candle.high - Math.max(candle.open, candle.close)) / range;
  const lowerWickRatio = (Math.min(candle.open, candle.close) - candle.low) / range;
  const closePositionInCandle = (candle.close - candle.low) / range;
  const bodyRatio = Math.abs(candle.close - candle.open) / range;

  return {
    upperWickRatio,
    lowerWickRatio,
    closePositionInCandle,
    bodyRatio,
    isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
    isStrongClose: closePositionInCandle >= 0.7,
    isWeakClose: closePositionInCandle <= 0.35,
    isLongUpperWick: upperWickRatio > 0.45,
    isLongLowerWick: lowerWickRatio > 0.45,
    isRedCandle: candle.close < candle.open,
  };
}

function getBollingerPercent(snapshot: IndicatorSnapshot) {
  const upper = snapshot.bollinger.upper;
  const lower = snapshot.bollinger.lower;

  if (upper === null || lower === null || upper === lower) {
    return snapshot.bollinger.widthPercentile;
  }

  return ((snapshot.close - lower) / (upper - lower)) * 100;
}

function getMacdState(snapshot: IndicatorSnapshot): ScannerDerivedMetrics["macdState"] {
  if (
    snapshot.macd.line === null ||
    snapshot.macd.signal === null ||
    snapshot.macd.histogram === null
  ) {
    return null;
  }

  if (snapshot.macd.aboveZero && snapshot.macd.histogramRising) {
    return snapshot.macd.bullishCross ? "strong" : "improving";
  }

  if (snapshot.macd.histogramRising) {
    return "improving";
  }

  if (snapshot.macd.bearishCross) {
    return "weak";
  }

  if (Math.abs(snapshot.macd.histogram) < Math.abs(snapshot.macd.line) * 0.05) {
    return "flat";
  }

  return "weakening";
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

function dedupe<T>(items: T[]) {
  return Array.from(new Set(items));
}
