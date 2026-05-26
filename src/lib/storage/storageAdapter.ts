import {
  toScanSignalRecords,
  toScanSnapshotRecord,
  type PersistScanSignalsInput,
  type ScanSignalRecord,
  type ScanSnapshotRecord,
} from "./scanSignalModel";
import type {
  EvaluationHorizon,
  EvaluationSummaryBucket,
  SignalForwardEvaluation,
} from "./scanEvaluation";

export type StorageMode = "jsonl" | "sqlite" | "disabled";

export type ScanSignalQuery = {
  limit?: number;
  timeframe?: string;
  scoringVersion?: string;
};

export type PendingEvaluationQuery = ScanSignalQuery & {
  horizon: EvaluationHorizon;
};

export type EvaluationQuery = {
  limit?: number;
  horizon?: EvaluationHorizon;
  timeframe?: string;
  scoringVersion?: string;
};

export type PerformanceQuery = EvaluationQuery;

export type PerformanceGroup = EvaluationSummaryBucket & {
  group: string;
};

export type PruneResearchDataInput = {
  signalDays?: number;
  snapshotDays?: number;
  evaluationDays?: number;
};

export type PruneResearchDataResult = {
  snapshotsDeleted: number;
  signalsDeleted: number;
  evaluationsDeleted: number;
};

export type ScannerStorageAdapter = {
  mode: StorageMode;
  createScanSnapshot(input: PersistScanSignalsInput): Promise<ScanSnapshotRecord>;
  saveScanSignals(snapshotId: string, signals: ScanSignalRecord[]): Promise<void>;
  persistScanResults(input: PersistScanSignalsInput): Promise<{
    snapshot: ScanSnapshotRecord;
    signals: ScanSignalRecord[];
  }>;
  listScanSignals(query: ScanSignalQuery): Promise<ScanSignalRecord[]>;
  getPendingEvaluations(query: PendingEvaluationQuery): Promise<ScanSignalRecord[]>;
  saveForwardEvaluations(evaluations: SignalForwardEvaluation[]): Promise<void>;
  listForwardEvaluations(query: EvaluationQuery): Promise<SignalForwardEvaluation[]>;
  getSignalPerformanceByLabel(query: PerformanceQuery): Promise<PerformanceGroup[]>;
  getSignalPerformanceByActionBias(query: PerformanceQuery): Promise<PerformanceGroup[]>;
  getSignalPerformanceByRiskType(query: PerformanceQuery): Promise<PerformanceGroup[]>;
  getSignalPerformanceByTimeframe(query: PerformanceQuery): Promise<PerformanceGroup[]>;
  getSignalPerformanceByScoreBucket(query: PerformanceQuery): Promise<PerformanceGroup[]>;
  pruneResearchData(input?: PruneResearchDataInput): Promise<PruneResearchDataResult>;
  close?(): void | Promise<void>;
};

export async function getScannerStorageAdapter(): Promise<ScannerStorageAdapter> {
  const requested = getRequestedStorageMode();

  if (requested === "disabled") {
    return createDisabledStorageAdapter();
  }

  if (requested === "sqlite") {
    try {
      const { ScanSignalSqliteStore } = await import("./sqlite/scanSignalSqlite");
      return new ScanSignalSqliteStore();
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "SQLite research storage unavailable, falling back to JSONL:",
          error instanceof Error ? error.message : error,
        );
      }
      const { JsonlScannerStorageAdapter } = await import("./jsonlStorageAdapter");
      return new JsonlScannerStorageAdapter();
    }
  }

  const { JsonlScannerStorageAdapter } = await import("./jsonlStorageAdapter");
  return new JsonlScannerStorageAdapter();
}

export function getRequestedStorageMode(): StorageMode {
  const raw = process.env.SCANNER_RESEARCH_STORAGE;

  if (raw === "jsonl" || raw === "sqlite" || raw === "disabled") {
    return raw;
  }

  if (process.env.DEPLOY_TARGET === "cloudflare") {
    return "disabled";
  }

  return "sqlite";
}

export function createSnapshotAndSignals(input: PersistScanSignalsInput) {
  const snapshot = toScanSnapshotRecord(input);
  const signals = toScanSignalRecords({ snapshot, results: input.results });
  return { snapshot, signals };
}

export function createDisabledStorageAdapter(): ScannerStorageAdapter {
  return {
    mode: "disabled",
    async createScanSnapshot(input) {
      return toScanSnapshotRecord(input);
    },
    async saveScanSignals() {},
    async persistScanResults(input) {
      return createSnapshotAndSignals(input);
    },
    async listScanSignals() {
      return [];
    },
    async getPendingEvaluations() {
      return [];
    },
    async saveForwardEvaluations() {},
    async listForwardEvaluations() {
      return [];
    },
    async getSignalPerformanceByLabel() {
      return [];
    },
    async getSignalPerformanceByActionBias() {
      return [];
    },
    async getSignalPerformanceByRiskType() {
      return [];
    },
    async getSignalPerformanceByTimeframe() {
      return [];
    },
    async getSignalPerformanceByScoreBucket() {
      return [];
    },
    async pruneResearchData() {
      return {
        snapshotsDeleted: 0,
        signalsDeleted: 0,
        evaluationsDeleted: 0,
      };
    },
  };
}
