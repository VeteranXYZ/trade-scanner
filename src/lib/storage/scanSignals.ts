import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  toScanSignalRecords,
  toScanSnapshotRecord,
  type PersistScanSignalsInput,
  type ScanSignalRecord,
  type ScanSnapshotRecord,
} from "./scanSignalModel";

export type {
  PersistScanSignalsInput,
  ScanSignalRecord,
  ScanSnapshotRecord,
};

const dataDir = path.join(process.cwd(), ".data");
const signalSnapshotsFile = path.join(dataDir, "scan-signal-snapshots.jsonl");
const scanSignalsFile = path.join(dataDir, "scan-signals.jsonl");

export async function persistScanSignals(input: PersistScanSignalsInput) {
  const snapshot = toScanSnapshotRecord(input);
  const signals = toScanSignalRecords({ snapshot, results: input.results });

  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    appendFile(signalSnapshotsFile, `${JSON.stringify(snapshot)}\n`, "utf8"),
    signals.length > 0
      ? appendFile(
          scanSignalsFile,
          `${signals.map((signal) => JSON.stringify(signal)).join("\n")}\n`,
          "utf8",
        )
      : Promise.resolve(),
  ]);

  return { snapshot, signals };
}

export async function safePersistScanSignals(input: PersistScanSignalsInput) {
  try {
    return await persistScanSignals(input);
  } catch (error) {
    console.warn(
      "Failed to persist scan signals:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getRecentScanSignalSnapshots(limit = 50) {
  const snapshots = await readJsonl<ScanSnapshotRecord>(signalSnapshotsFile);
  return snapshots.slice(-limit).reverse();
}

export async function getRecentScanSignals(limit = 500) {
  const signals = await readJsonl<ScanSignalRecord>(scanSignalsFile);
  return signals.slice(-limit).reverse();
}

export async function getAllScanSignals() {
  return readJsonl<ScanSignalRecord>(scanSignalsFile);
}

async function readJsonl<T>(filePath: string) {
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
