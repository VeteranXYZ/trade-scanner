export type DataSortDirection = "asc" | "desc";

export type DataSortState<TKey extends string> = {
  key: TKey;
  direction: DataSortDirection;
};

export type DataSortValue = string | number | boolean | Date | null | undefined;

export function getNextDataSortState<TKey extends string>({
  current,
  key,
  defaultDirection = "asc",
}: {
  current: DataSortState<TKey> | null;
  key: TKey;
  defaultDirection?: DataSortDirection;
}) {
  if (!current || current.key !== key) {
    return { key, direction: defaultDirection };
  }

  if (current.direction === defaultDirection) {
    return {
      key,
      direction: defaultDirection === "asc" ? "desc" : "asc",
    } satisfies DataSortState<TKey>;
  }

  return null;
}

export function sortDataRows<TRow, TKey extends string>(
  rows: TRow[],
  sortState: DataSortState<TKey> | null,
  getValue: (row: TRow, key: TKey, index: number) => DataSortValue,
) {
  if (!sortState) {
    return rows;
  }

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const valueDelta = compareDataSortValues(
        getValue(left.row, sortState.key, left.index),
        getValue(right.row, sortState.key, right.index),
        sortState.direction,
      );

      return valueDelta === 0 ? left.index - right.index : valueDelta;
    })
    .map(({ row }) => row);
}

export function compareDataSortValues(
  left: DataSortValue,
  right: DataSortValue,
  direction: DataSortDirection,
) {
  const leftNormalized = normalizeDataSortValue(left);
  const rightNormalized = normalizeDataSortValue(right);
  const leftMissing = leftNormalized === null;
  const rightMissing = rightNormalized === null;

  if (leftMissing && rightMissing) {
    return 0;
  }

  if (leftMissing) {
    return 1;
  }

  if (rightMissing) {
    return -1;
  }

  const delta =
    typeof leftNormalized === "number" && typeof rightNormalized === "number"
      ? leftNormalized - rightNormalized
      : String(leftNormalized).localeCompare(String(rightNormalized));

  return direction === "asc" ? delta : -delta;
}

export function formatDataSortDirection(direction: DataSortDirection) {
  return direction === "asc" ? "ASC" : "DESC";
}

function normalizeDataSortValue(value: DataSortValue) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const text = value.trim();

  return text ? text.toLowerCase() : null;
}
