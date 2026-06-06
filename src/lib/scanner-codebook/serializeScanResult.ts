import { classifyScanResultGroup } from "@/lib/scanner/scanResultGroups";
import type {
  ScannerExplanation,
  ScannerObservation,
  ScanResult,
} from "@/lib/shared/scannerTypes";
import {
  actionCodeByBias,
  explanationCodeByKey,
  groupCodeByResultGroup,
  observationCodeByKey,
  phaseCodeByMarketPhase,
  riskCodeByType,
  scannerCodeVersions,
  setupCodeByPrimaryStructure,
  signalCodeByLabel,
  type ActiveScannerCode,
} from "./codeRegistry";

export type ScannerCodeMetrics = {
  score: number;
  rankScore: number;
  finalSignalScore: number;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  qualityScore: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  structureScore: number;
  volumeRank: number | null;
  historyBars: number;
  price: number;
  rsi14: number | null;
  bbPercent: number | null;
  bbWidthPercentile: number | null;
  volumeRatio: number | null;
};

export type ScannerCodeContractResult = {
  exchange: "binance";
  symbol: string;
  timeframe: string;
  assetClass?: string;
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
  metrics: ScannerCodeMetrics;
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
};

export function serializeScanResultToCodeContract(
  result: ScanResult,
): ScannerCodeContractResult {
  const resultGroup = classifyScanResultGroup(result);
  const riskCodes = uniqueCodes(
    (result.detectedRiskTypes ?? []).map((risk) => riskCodeByType[risk] ?? "NX_801"),
  );
  const signalCodes = uniqueCodes([
    signalCodeByLabel[result.signalLabel] ?? "NX_801",
    ...observationsToCodes(result.bullishObservations ?? []),
    ...observationsToCodes(result.bearishObservations ?? []),
    ...observationsToCodes(result.neutralObservations ?? []),
  ]);
  const reasonCodes = uniqueCodes([
    ...explanationsToCodes(result.reasons ?? []),
    ...explanationsToCodes(result.warnings ?? []),
    ...observationsToCodes(result.riskObservations ?? []),
    ...observationsToCodes(result.nextConfirmationObservations ?? []),
    ...observationsToCodes(result.invalidationObservations ?? []),
    ...explanationsToCodes(result.nextConfirmation ?? []),
    ...explanationsToCodes(result.invalidation ?? []),
  ]);

  return {
    exchange: result.exchange,
    symbol: result.symbol,
    timeframe: result.timeframe,
    groupCode: groupCodeByResultGroup[resultGroup],
    actionCode: actionCodeByBias[result.actionBias] ?? "NX_801",
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode: setupCodeByPrimaryStructure[result.primaryStructure] ?? "NX_801",
    phaseCode: phaseCodeByMarketPhase[result.phase] ?? "NX_801",
    reasonCodes,
    signalCodes,
    qualityCodes: getQualityCodes(result),
    metrics: {
      score: result.rankScore,
      rankScore: result.rankScore,
      finalSignalScore: result.finalSignalScore ?? result.rankScore ?? 0,
      opportunityScore: result.opportunityScore ?? 0,
      confirmationScore: result.confirmationScore ?? 0,
      riskScore: result.riskScore ?? 0,
      qualityScore: calculateQualityScore(result),
      trendScore: result.trendScore ?? 0,
      momentumScore: result.momentumScore ?? 0,
      volumeScore: result.volumeScore ?? 0,
      structureScore: result.structureScore ?? 0,
      volumeRank: result.volume?.ratio20 ?? null,
      historyBars: result.dataQuality?.candleCount ?? 0,
      price: result.price,
      rsi14: result.rsi14,
      bbPercent: result.bbPercent,
      bbWidthPercentile: result.bbWidthPercentile,
      volumeRatio: result.volumeRatio,
    },
    ...scannerCodeVersions,
  };
}

function observationsToCodes(observations: ScannerObservation[]) {
  return observations
    .map((observation) => observationCodeByKey[observation.key])
    .filter(isActiveScannerCode);
}

function explanationsToCodes(explanations: ScannerExplanation[]) {
  return explanations
    .map((explanation) => explanationCodeByKey[explanation.key])
    .filter(isActiveScannerCode);
}

function getQualityCodes(result: ScanResult) {
  const codes: ActiveScannerCode[] = [];

  if (!result.dataQuality?.sufficientHistory) {
    codes.push("QH_201");
  }

  if ((result.dataQuality?.missingIndicators ?? []).length > 0) {
    codes.push("QH_101");
  }

  if (result.volume?.ratio20 !== null && result.volume?.ratio20 < 0.75) {
    codes.push("VL_104");
  }

  if (codes.length === 0) {
    codes.push("QH_001");
  }

  return uniqueCodes(codes);
}

function calculateQualityScore(result: ScanResult) {
  let score = result.dataQuality?.sufficientHistory ? 70 : 35;

  if ((result.dataQuality?.candleCount ?? 0) >= 420) {
    score += 15;
  } else if ((result.dataQuality?.candleCount ?? 0) >= 200) {
    score += 10;
  }

  if (result.volume?.ratio20 !== null && result.volume?.ratio20 >= 1) {
    score += 10;
  }

  if ((result.dataQuality?.missingIndicators ?? []).length === 0) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

function uniqueCodes(codes: ActiveScannerCode[]) {
  return [...new Set(codes)];
}

function isActiveScannerCode(
  code: ActiveScannerCode | undefined,
): code is ActiveScannerCode {
  return code !== undefined;
}
