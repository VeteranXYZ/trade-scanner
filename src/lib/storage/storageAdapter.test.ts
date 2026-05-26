import { describe, expect, it } from "vitest";
import { getRequestedStorageMode, getScannerStorageAdapter } from "./storageAdapter";

describe("scanner storage adapter", () => {
  it("supports disabled storage without throwing", async () => {
    const previous = process.env.SCANNER_RESEARCH_STORAGE;
    process.env.SCANNER_RESEARCH_STORAGE = "disabled";

    try {
      expect(getRequestedStorageMode()).toBe("disabled");
      const adapter = await getScannerStorageAdapter();
      expect(adapter.mode).toBe("disabled");
      expect(await adapter.listScanSignals({ limit: 10 })).toEqual([]);
      await expect(adapter.saveForwardEvaluations([])).resolves.toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.SCANNER_RESEARCH_STORAGE;
      } else {
        process.env.SCANNER_RESEARCH_STORAGE = previous;
      }
    }
  });
});
