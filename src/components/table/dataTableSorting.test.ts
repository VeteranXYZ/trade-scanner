import { describe, expect, it } from "vitest";
import {
  getNextDataSortState,
  sortDataRows,
  type DataSortState,
} from "./dataTableSorting";

describe("dataTableSorting", () => {
  it("returns the original row array when no sort state is active", () => {
    const rows = [
      { id: "second", score: 2 },
      { id: "first", score: 1 },
    ];

    expect(sortDataRows(rows, null, (row) => row.score)).toBe(rows);
  });

  it("sorts numbers descending, keeps ties stable, and leaves missing values last", () => {
    const rows = [
      { id: "low", score: 1 },
      { id: "missing-a", score: null },
      { id: "high-a", score: 3 },
      { id: "high-b", score: 3 },
      { id: "missing-b", score: undefined },
    ];

    expect(
      sortDataRows(rows, { key: "score", direction: "desc" }, (row) => row.score)
        .map((row) => row.id),
    ).toEqual(["high-a", "high-b", "low", "missing-a", "missing-b"]);
  });

  it("sorts strings case-insensitively with blank values last", () => {
    const rows = [
      { id: "beta", symbol: "Beta" },
      { id: "blank", symbol: "" },
      { id: "alpha", symbol: "alpha" },
    ];

    expect(
      sortDataRows(rows, { key: "symbol", direction: "asc" }, (row) => row.symbol)
        .map((row) => row.id),
    ).toEqual(["alpha", "beta", "blank"]);
  });

  it("cycles header sort state from default direction to opposite direction to inactive", () => {
    const first = getNextDataSortState({
      current: null,
      key: "rank",
      defaultDirection: "desc",
    });
    const second = getNextDataSortState({
      current: first,
      key: "rank",
      defaultDirection: "desc",
    });
    const third = getNextDataSortState({
      current: second as DataSortState<"rank">,
      key: "rank",
      defaultDirection: "desc",
    });

    expect(first).toEqual({ key: "rank", direction: "desc" });
    expect(second).toEqual({ key: "rank", direction: "asc" });
    expect(third).toBeNull();
  });
});
