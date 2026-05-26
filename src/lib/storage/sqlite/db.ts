import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initializeScannerResearchSchema } from "./schema";

export class ScannerResearchDb {
  readonly db: DatabaseSync;

  constructor(dbPath = getDefaultScannerResearchDbPath()) {
    if (dbPath !== ":memory:") {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    initializeScannerResearchSchema(this.db);
  }

  close() {
    this.db.close();
  }

  transaction<T>(callback: () => T) {
    this.db.exec("BEGIN");

    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDefaultScannerResearchDbPath() {
  return path.join(process.cwd(), ".data", "scanner-research.sqlite");
}
