import { calculateSma } from "./movingAverage";

export type VolumeSnapshot = {
  current: number;
  ma20: number | null;
  ratio: number | null;
};

export function calculateVolumeSnapshot(volumes: number[]): VolumeSnapshot {
  const current = volumes.at(-1) ?? 0;
  const ma20 = calculateSma(volumes, 20);

  return {
    current,
    ma20,
    ratio: ma20 && ma20 !== 0 ? current / ma20 : null,
  };
}
