import { migrateJsonlResearchToSqlite } from "../src/lib/storage/sqlite/migrateJsonlToSqlite";
import { parseJsonArray } from "../src/lib/storage/scanSignalModel";
import {
  parseEvaluateOptions,
  parseInspectOptions,
  parsePruneOptions,
  parseResearchCommand,
} from "../src/lib/storage/researchCli";
import { runResearchEvaluationJob } from "../src/lib/storage/researchEvaluationJob";
import { getResearchStats } from "../src/lib/storage/researchStats";
import { getScannerStorageAdapter } from "../src/lib/storage/storageAdapter";

async function main() {
  const [, , rawCommand, ...args] = process.argv;
  const command = parseResearchCommand(rawCommand);

  switch (command) {
    case "migrate":
      printJson(await migrateJsonlResearchToSqlite());
      return;
    case "evaluate":
      printJson(await runResearchEvaluationJob(parseEvaluateOptions(args)));
      return;
    case "prune":
      await runPrune(args);
      return;
    case "stats":
      printJson(await getResearchStats());
      return;
    case "inspect":
      await runInspect(args);
      return;
  }
}

async function runPrune(args: string[]) {
  const options = parsePruneOptions(args);
  const before = await getResearchStats();

  if (options.dryRun) {
    printJson({
      dryRun: true,
      before,
      message: "No rows deleted. Re-run with --execute to apply pruning.",
    });
    return;
  }

  const storage = await getScannerStorageAdapter();
  try {
    const deleted = await storage.pruneResearchData({
      signalDays: options.signalDays,
      snapshotDays: options.snapshotDays,
      evaluationDays: options.evaluationDays,
    });
    const after = await getResearchStats();
    printJson({
      dryRun: false,
      deleted,
      before,
      after,
    });
  } finally {
    await storage.close?.();
  }
}

async function runInspect(args: string[]) {
  const options = parseInspectOptions(args);
  const storage = await getScannerStorageAdapter();

  try {
    const [signals, evaluations] = await Promise.all([
      storage.listScanSignals({
        limit: 500,
        timeframe: options.timeframe,
      }),
      storage.listForwardEvaluations({
        limit: 1000,
        timeframe: options.timeframe,
      }),
    ]);
    const evaluationsBySignal = new Map<string, typeof evaluations>();

    for (const evaluation of evaluations) {
      evaluationsBySignal.set(evaluation.signalId, [
        ...(evaluationsBySignal.get(evaluation.signalId) ?? []),
        evaluation,
      ]);
    }

    const rows = signals
      .filter((signal) => !options.symbol || signal.symbol === options.symbol)
      .filter((signal) => !options.label || signal.signalLabel === options.label)
      .filter(
        (signal) =>
          !options.risk ||
          parseJsonArray(signal.detectedRiskTypesJson).includes(options.risk),
      )
      .slice(0, options.limit)
      .map((signal) => {
        const signalEvaluations = evaluationsBySignal.get(signal.id) ?? [];
        return {
          id: signal.id,
          symbol: signal.symbol,
          timeframe: signal.timeframe,
          scanTime: signal.scanTime,
          priceAtSignal: signal.priceAtSignal,
          signalLabel: signal.signalLabel,
          actionBias: signal.actionBias,
          finalSignalScore: signal.finalSignalScore,
          opportunityScore: signal.opportunityScore,
          confirmationScore: signal.confirmationScore,
          riskScore: signal.riskScore,
          detectedRiskTypes: parseJsonArray(signal.detectedRiskTypesJson),
          evaluations: signalEvaluations.map((evaluation) => ({
            horizon: evaluation.horizon,
            outcomeLabel: evaluation.outcomeLabel,
            evaluationTime: evaluation.evaluationTime,
            returnPct: evaluation.returnPct,
            maxDrawdownPct: evaluation.maxDrawdownPct,
          })),
        };
      });

    printJson({
      storageMode: storage.mode,
      count: rows.length,
      rows,
    });
  } finally {
    await storage.close?.();
  }
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
