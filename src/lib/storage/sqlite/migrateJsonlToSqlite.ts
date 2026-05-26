import { readFile } from "node:fs/promises";
import {
  getStoredForwardEvaluations,
  type SignalForwardEvaluation,
} from "../scanEvaluation";
import {
  getAllScanSignals,
  getRecentScanSignalSnapshots,
} from "../scanSignals";
import type { ScanSignalRecord, ScanSnapshotRecord } from "../scanSignalModel";
import { ScanSignalSqliteStore } from "./scanSignalSqlite";

export type JsonlResearchMigrationStats = {
  snapshotsRead: number;
  snapshotsInserted: number;
  signalsRead: number;
  signalsInserted: number;
  evaluationsRead: number;
  evaluationsInserted: number;
  skipped: number;
  errors: string[];
};

export async function migrateJsonlResearchToSqlite(options: {
  dbPath?: string;
  snapshotsFile?: string;
  signalsFile?: string;
  evaluationsFile?: string;
} = {}) {
  const store = new ScanSignalSqliteStore(options.dbPath);
  const stats: JsonlResearchMigrationStats = {
    snapshotsRead: 0,
    snapshotsInserted: 0,
    signalsRead: 0,
    signalsInserted: 0,
    evaluationsRead: 0,
    evaluationsInserted: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const snapshots = options.snapshotsFile
      ? await readJsonlFile<ScanSnapshotRecord>(options.snapshotsFile)
      : await getRecentScanSignalSnapshots(Number.MAX_SAFE_INTEGER);
    const signals = options.signalsFile
      ? await readJsonlFile<ScanSignalRecord>(options.signalsFile)
      : await getAllScanSignals();
    const evaluations = options.evaluationsFile
      ? await readJsonlFile<SignalForwardEvaluation>(options.evaluationsFile)
      : await getStoredForwardEvaluations();
    stats.snapshotsRead = snapshots.length;
    stats.signalsRead = signals.length;
    stats.evaluationsRead = evaluations.length;

    for (const snapshot of snapshots.reverse()) {
      try {
        if (await store.saveScanSnapshotRecord(snapshot)) {
          stats.snapshotsInserted += 1;
        } else {
          stats.skipped += 1;
        }
      } catch (error) {
        stats.skipped += 1;
        stats.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    for (const signal of signals) {
      try {
        if (await store.saveScanSignalRecord(signal)) {
          stats.signalsInserted += 1;
        } else {
          stats.skipped += 1;
        }
      } catch (error) {
        stats.skipped += 1;
        stats.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    try {
      const beforeEvaluationIds = new Set(
        (await store.listForwardEvaluations({ limit: Number.MAX_SAFE_INTEGER })).map(
          (evaluation) => evaluation.id,
        ),
      );
      await store.saveForwardEvaluations(evaluations);
      stats.evaluationsInserted = evaluations.filter(
        (evaluation) => !beforeEvaluationIds.has(evaluation.id),
      ).length;
      stats.skipped += evaluations.length - stats.evaluationsInserted;
    } catch (error) {
      stats.skipped += evaluations.length;
      stats.errors.push(error instanceof Error ? error.message : String(error));
    }

    return stats;
  } finally {
    store.close();
  }
}

async function readJsonlFile<T>(filePath: string) {
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
