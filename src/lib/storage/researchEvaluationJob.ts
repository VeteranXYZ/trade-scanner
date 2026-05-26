import type { Candle } from "@/lib/exchanges/types";
import { evaluateSignalForward, type EvaluationHorizon } from "./scanEvaluation";
import type { ScanSignalRecord } from "./scanSignalModel";
import {
  getScannerStorageAdapter,
  type ScannerStorageAdapter,
  type StorageMode,
} from "./storageAdapter";

export type ResearchEvaluationJobOptions = {
  horizon?: EvaluationHorizon;
  timeframe?: string;
  limit?: number;
  dryRun?: boolean;
  storage?: ScannerStorageAdapter;
  getCandles?: (signal: ScanSignalRecord) => Candle[] | Promise<Candle[]>;
};

export type ResearchEvaluationJobResult = {
  storageMode: StorageMode;
  horizon: EvaluationHorizon;
  checked: number;
  evaluated: number;
  insufficientData: number;
  skipped: number;
  errors: number;
  latestEvaluationTime?: string;
};

export async function runResearchEvaluationJob({
  horizon = "24h",
  timeframe,
  limit = 100,
  dryRun = false,
  storage: providedStorage,
  getCandles,
}: ResearchEvaluationJobOptions = {}): Promise<ResearchEvaluationJobResult> {
  const storage = providedStorage ?? (await getScannerStorageAdapter());
  const shouldCloseStorage = providedStorage === undefined;
  const result: ResearchEvaluationJobResult = {
    storageMode: storage.mode,
    horizon,
    checked: 0,
    evaluated: 0,
    insufficientData: 0,
    skipped: 0,
    errors: 0,
  };

  if (storage.mode === "disabled") {
    return result;
  }

  const marketData = getCandles ? null : await createMarketDataStore();

  try {
    const pendingSignals = await storage.getPendingEvaluations({
      horizon,
      timeframe,
      limit,
    });
    result.checked = pendingSignals.length;

    for (const signal of pendingSignals) {
      try {
        const candles = getCandles
          ? await getCandles(signal)
          : marketData!.getCandles({
              symbol: signal.symbol,
              timeframe: signal.timeframe,
              limit: 500,
            });
        const evaluation = evaluateSignalForward({ signal, candles, horizon });

        if (evaluation.outcomeLabel === "insufficient_data") {
          result.insufficientData += 1;
        } else {
          result.evaluated += 1;
          if (evaluation.evaluationTime) {
            result.latestEvaluationTime = latestIso(
              result.latestEvaluationTime,
              evaluation.evaluationTime,
            );
          }
        }

        if (!dryRun) {
          await storage.saveForwardEvaluations([evaluation]);
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors += 1;
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            `Research evaluation failed for ${signal.symbol} ${signal.timeframe}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    return result;
  } finally {
    marketData?.close();
    if (shouldCloseStorage) {
      await storage.close?.();
    }
  }
}

async function createMarketDataStore() {
  const { MarketDataStore } = await import("@/lib/storage/marketData");
  return new MarketDataStore();
}

function latestIso(current: string | undefined, next: string) {
  if (!current) {
    return next;
  }

  return Date.parse(next) > Date.parse(current) ? next : current;
}
