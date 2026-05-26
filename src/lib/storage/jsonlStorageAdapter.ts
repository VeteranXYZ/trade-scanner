import {
  getAllScanSignals,
  persistScanSignals,
  type PersistScanSignalsInput,
  type ScanSignalRecord,
} from "./scanSignals";
import {
  getSignalPerformanceByActionBias,
  getSignalPerformanceByLabel,
  getSignalPerformanceByRiskType,
  getSignalPerformanceByScoreBucket,
  getSignalPerformanceByTimeframe,
  getStoredForwardEvaluations,
  persistForwardEvaluations,
  type SignalForwardEvaluation,
} from "./scanEvaluation";
import {
  createSnapshotAndSignals,
  type EvaluationQuery,
  type PendingEvaluationQuery,
  type PerformanceGroup,
  type PerformanceQuery,
  type PruneResearchDataResult,
  type ScannerStorageAdapter,
  type ScanSignalQuery,
} from "./storageAdapter";

export class JsonlScannerStorageAdapter implements ScannerStorageAdapter {
  readonly mode = "jsonl" as const;

  async createScanSnapshot(input: PersistScanSignalsInput) {
    return createSnapshotAndSignals(input).snapshot;
  }

  async saveScanSignals() {
    // JSONL persists snapshots and signals together through persistScanResults.
  }

  async persistScanResults(input: PersistScanSignalsInput) {
    return persistScanSignals(input);
  }

  async listScanSignals(query: ScanSignalQuery) {
    return filterSignals(await getAllScanSignals(), query).slice(
      -(query.limit ?? Number.MAX_SAFE_INTEGER),
    ).reverse();
  }

  async getPendingEvaluations(query: PendingEvaluationQuery) {
    const [signals, evaluations] = await Promise.all([
      getAllScanSignals(),
      getStoredForwardEvaluations(),
    ]);
    const completed = new Set(
      evaluations
        .filter((evaluation) => evaluation.outcomeLabel !== "insufficient_data")
        .map((evaluation) => evaluation.id),
    );

    return filterSignals(signals, query)
      .filter((signal) => !completed.has(`${signal.id}:${query.horizon}`))
      .slice(-(query.limit ?? Number.MAX_SAFE_INTEGER))
      .reverse();
  }

  async saveForwardEvaluations(evaluations: SignalForwardEvaluation[]) {
    await persistForwardEvaluations(evaluations);
  }

  async listForwardEvaluations(query: EvaluationQuery) {
    const evaluations = await getStoredForwardEvaluations();
    return filterEvaluations(evaluations, query).slice(
      -(query.limit ?? Number.MAX_SAFE_INTEGER),
    ).reverse();
  }

  async getSignalPerformanceByLabel(query: PerformanceQuery) {
    return toPerformanceGroups(
      getSignalPerformanceByLabel(
        await this.listForwardEvaluations(query),
        await this.listScanSignals({ limit: Number.MAX_SAFE_INTEGER }),
      ),
    );
  }

  async getSignalPerformanceByActionBias(query: PerformanceQuery) {
    return toPerformanceGroups(
      getSignalPerformanceByActionBias(
        await this.listForwardEvaluations(query),
        await this.listScanSignals({ limit: Number.MAX_SAFE_INTEGER }),
      ),
    );
  }

  async getSignalPerformanceByRiskType(query: PerformanceQuery) {
    return toPerformanceGroups(
      getSignalPerformanceByRiskType(
        await this.listForwardEvaluations(query),
        await this.listScanSignals({ limit: Number.MAX_SAFE_INTEGER }),
      ),
    );
  }

  async getSignalPerformanceByTimeframe(query: PerformanceQuery) {
    return toPerformanceGroups(
      getSignalPerformanceByTimeframe(await this.listForwardEvaluations(query)),
    );
  }

  async getSignalPerformanceByScoreBucket(query: PerformanceQuery) {
    return toPerformanceGroups(
      getSignalPerformanceByScoreBucket(
        await this.listForwardEvaluations(query),
        await this.listScanSignals({ limit: Number.MAX_SAFE_INTEGER }),
      ),
    );
  }

  async pruneResearchData(): Promise<PruneResearchDataResult> {
    // JSONL pruning is intentionally not automatic; migrate to SQLite for pruning.
    return {
      snapshotsDeleted: 0,
      signalsDeleted: 0,
      evaluationsDeleted: 0,
    };
  }
}

function filterSignals(signals: ScanSignalRecord[], query: ScanSignalQuery) {
  return signals.filter(
    (signal) =>
      (query.timeframe === undefined || signal.timeframe === query.timeframe) &&
      (query.scoringVersion === undefined ||
        signal.scoringVersion === query.scoringVersion),
  );
}

function filterEvaluations(
  evaluations: SignalForwardEvaluation[],
  query: EvaluationQuery,
) {
  return evaluations.filter(
    (evaluation) =>
      (query.horizon === undefined || evaluation.horizon === query.horizon) &&
      (query.timeframe === undefined || evaluation.timeframe === query.timeframe),
  );
}

function toPerformanceGroups(
  record: Record<string, Omit<PerformanceGroup, "group">>,
): PerformanceGroup[] {
  return Object.entries(record).map(([group, value]) => ({ group, ...value }));
}
