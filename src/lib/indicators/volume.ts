import { calculateSma } from "./movingAverage";

export const volumeThresholds = {
  dryUpRatio20: 0.6,
  quietCompressionMinRatio20: 0.4,
  quietCompressionMaxRatio20: 0.9,
  expansionRatio20: 1.5,
  abnormalSpikeRatio20: 3,
  strongAbnormalSpikeRatio20: 5,
  healthyPullbackMaxRatio20: 1.2,
  distributionMinRatio20: 1.8,
} as const;

export type VolumeSnapshot = {
  current: number;
  latest: number;
  ma20: number | null;
  ma50: number | null;
  ratio: number | null;
  ratio20: number | null;
  ratio50: number | null;
  quoteVolumeLatest?: number;
  quoteVolumeMA20?: number | null;
  dryUp: boolean;
  expanding: boolean;
  abnormalSpike: boolean;
};

export function calculateVolumeSnapshot(
  volumes: number[],
  quoteVolumes: Array<number | undefined> = [],
): VolumeSnapshot {
  const current = volumes.at(-1) ?? 0;
  const ma20 = calculatePreviousSma(volumes, 20);
  const ma50 = calculatePreviousSma(volumes, 50);
  const ratio20 = ma20 && ma20 !== 0 ? current / ma20 : null;
  const ratio50 = ma50 && ma50 !== 0 ? current / ma50 : null;
  const quoteVolumeLatest = quoteVolumes.at(-1);
  const validQuoteVolumes = quoteVolumes.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const quoteVolumeMA20 =
    validQuoteVolumes.length === quoteVolumes.length
      ? calculatePreviousSma(validQuoteVolumes, 20)
      : null;

  return {
    current,
    latest: current,
    ma20,
    ma50,
    ratio: ratio20,
    ratio20,
    ratio50,
    quoteVolumeLatest,
    quoteVolumeMA20,
    dryUp: ratio20 !== null && ratio20 < volumeThresholds.dryUpRatio20,
    expanding: ratio20 !== null && ratio20 >= volumeThresholds.expansionRatio20,
    abnormalSpike:
      ratio20 !== null && ratio20 >= volumeThresholds.abnormalSpikeRatio20,
  };
}

function calculatePreviousSma(values: number[], period: number) {
  if (values.length <= period) {
    return null;
  }

  return calculateSma(values.slice(-period - 1, -1), period);
}
