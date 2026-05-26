import { getStoredForwardEvaluations } from "./scanEvaluation";
import { parseJsonArray, type ScanSignalRecord } from "./scanSignalModel";
import {
  getAllScanSignals,
  getRecentScanSignalSnapshots,
} from "./scanSignals";
import { getRequestedStorageMode, type StorageMode } from "./storageAdapter";
import { getDefaultScannerResearchDbPath, ScannerResearchDb } from "./sqlite/db";

export type ResearchStatsGroup = {
  count: number;
};

export type ResearchStats = {
  storageMode: StorageMode;
  databasePath?: string;
  totalSnapshots: number;
  totalSignals: number;
  totalEvaluations: number;
  pendingEvaluations: number;
  insufficientDataCount: number;
  latestScanTime?: string;
  latestEvaluationTime?: string;
  scoringVersions: Array<{ scoringVersion: string; count: number }>;
  bySignalLabel: Array<{ signalLabel: string; count: number }>;
  byActionBias: Array<{ actionBias: string; count: number }>;
  byRiskType: Array<{ riskType: string; count: number }>;
  byTimeframe: Array<{ timeframe: string; count: number }>;
};

export async function getResearchStats(options: {
  storageMode?: StorageMode;
  sqliteDbPath?: string;
} = {}): Promise<ResearchStats> {
  const storageMode = options.storageMode ?? getRequestedStorageMode();

  if (storageMode === "disabled") {
    return emptyStats("disabled");
  }

  if (storageMode === "sqlite") {
    return getSqliteResearchStats(options.sqliteDbPath);
  }

  return getJsonlResearchStats();
}

function getSqliteResearchStats(dbPath = getDefaultScannerResearchDbPath()) {
  const researchDb = new ScannerResearchDb(dbPath);

  try {
    return {
      storageMode: "sqlite" as const,
      databasePath:
        process.env.NODE_ENV === "production" ? undefined : dbPath,
      totalSnapshots: count(researchDb, "SELECT COUNT(*) AS count FROM scan_snapshots"),
      totalSignals: count(researchDb, "SELECT COUNT(*) AS count FROM scan_signals"),
      totalEvaluations: count(
        researchDb,
        "SELECT COUNT(*) AS count FROM signal_forward_evaluations",
      ),
      pendingEvaluations: count(
        researchDb,
        `
        SELECT COUNT(*) AS count
        FROM scan_signals s
        WHERE NOT EXISTS (
          SELECT 1
          FROM signal_forward_evaluations e
          WHERE e.signal_id = s.id
            AND e.outcome_label != 'insufficient_data'
        )
      `,
      ),
      insufficientDataCount: count(
        researchDb,
        "SELECT COUNT(*) AS count FROM signal_forward_evaluations WHERE outcome_label = 'insufficient_data'",
      ),
      latestScanTime: value<string>(
        researchDb,
        "SELECT MAX(scan_time) AS value FROM scan_signals",
      ),
      latestEvaluationTime: value<string>(
        researchDb,
        "SELECT MAX(evaluation_time) AS value FROM signal_forward_evaluations",
      ),
      scoringVersions: group(
        researchDb,
        "SELECT scoring_version AS name, COUNT(*) AS count FROM scan_signals GROUP BY scoring_version ORDER BY count DESC",
      ).map(({ name, count }) => ({ scoringVersion: name, count })),
      bySignalLabel: group(
        researchDb,
        "SELECT signal_label AS name, COUNT(*) AS count FROM scan_signals GROUP BY signal_label ORDER BY count DESC",
      ).map(({ name, count }) => ({ signalLabel: name, count })),
      byActionBias: group(
        researchDb,
        "SELECT action_bias AS name, COUNT(*) AS count FROM scan_signals GROUP BY action_bias ORDER BY count DESC",
      ).map(({ name, count }) => ({ actionBias: name, count })),
      byRiskType: group(
        researchDb,
        "SELECT risk_type AS name, COUNT(*) AS count FROM scan_signal_risk_types GROUP BY risk_type ORDER BY count DESC",
      ).map(({ name, count }) => ({ riskType: name, count })),
      byTimeframe: group(
        researchDb,
        "SELECT timeframe AS name, COUNT(*) AS count FROM scan_signals GROUP BY timeframe ORDER BY count DESC",
      ).map(({ name, count }) => ({ timeframe: name, count })),
    };
  } finally {
    researchDb.close();
  }
}

async function getJsonlResearchStats(): Promise<ResearchStats> {
  const [snapshots, signals, evaluations] = await Promise.all([
    getRecentScanSignalSnapshots(Number.MAX_SAFE_INTEGER),
    getAllScanSignals(),
    getStoredForwardEvaluations(),
  ]);
  const completedSignalIds = new Set(
    evaluations
      .filter((evaluation) => evaluation.outcomeLabel !== "insufficient_data")
      .map((evaluation) => evaluation.signalId),
  );

  return {
    storageMode: "jsonl",
    totalSnapshots: snapshots.length,
    totalSignals: signals.length,
    totalEvaluations: evaluations.length,
    pendingEvaluations: signals.filter((signal) => !completedSignalIds.has(signal.id))
      .length,
    insufficientDataCount: evaluations.filter(
      (evaluation) => evaluation.outcomeLabel === "insufficient_data",
    ).length,
    latestScanTime: maxIso(signals.map((signal) => signal.scanTime)),
    latestEvaluationTime: maxIso(
      evaluations
        .map((evaluation) => evaluation.evaluationTime)
        .filter((item): item is string => item !== null),
    ),
    scoringVersions: countBy(signals, (signal) => signal.scoringVersion).map(
      ({ name, count }) => ({ scoringVersion: name, count }),
    ),
    bySignalLabel: countBy(signals, (signal) => signal.signalLabel).map(
      ({ name, count }) => ({ signalLabel: name, count }),
    ),
    byActionBias: countBy(signals, (signal) => signal.actionBias).map(
      ({ name, count }) => ({ actionBias: name, count }),
    ),
    byRiskType: countRiskTypes(signals),
    byTimeframe: countBy(signals, (signal) => signal.timeframe).map(
      ({ name, count }) => ({ timeframe: name, count }),
    ),
  };
}

function emptyStats(storageMode: StorageMode): ResearchStats {
  return {
    storageMode,
    totalSnapshots: 0,
    totalSignals: 0,
    totalEvaluations: 0,
    pendingEvaluations: 0,
    insufficientDataCount: 0,
    scoringVersions: [],
    bySignalLabel: [],
    byActionBias: [],
    byRiskType: [],
    byTimeframe: [],
  };
}

function count(researchDb: ScannerResearchDb, sql: string) {
  const row = researchDb.db.prepare(sql).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

function value<T extends string>(researchDb: ScannerResearchDb, sql: string) {
  const row = researchDb.db.prepare(sql).get() as { value: T | null } | undefined;
  return row?.value ?? undefined;
}

function group(researchDb: ScannerResearchDb, sql: string) {
  return researchDb.db.prepare(sql).all() as Array<{
    name: string;
    count: number;
  }>;
}

function countBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function countRiskTypes(signals: ScanSignalRecord[]) {
  const map = new Map<string, number>();

  for (const signal of signals) {
    for (const riskType of parseJsonArray(signal.detectedRiskTypesJson)) {
      map.set(riskType, (map.get(riskType) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([riskType, count]) => ({ riskType, count }))
    .sort((a, b) => b.count - a.count);
}

function maxIso(values: string[]) {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}
