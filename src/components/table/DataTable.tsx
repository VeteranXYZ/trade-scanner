import type { ReactNode } from "react";
import {
  formatDataSortDirection,
  type DataSortDirection,
  type DataSortState,
} from "./dataTableSorting";

type CellAlign = "left" | "center" | "right";
export type ChipTone = "neutral" | "positive" | "info" | "warning" | "danger";

const alignClass: Record<CellAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const chipToneClass: Record<ChipTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--neutral-bg)] text-[var(--muted)]",
  positive:
    "border-emerald-500/35 bg-[var(--positive-bg)] text-[var(--positive)]",
  info: "border-sky-500/35 bg-[var(--info-bg)] text-[var(--info)]",
  warning:
    "border-amber-500/35 bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-rose-500/35 bg-[var(--danger-bg)] text-[var(--danger)]",
};

export function DataTableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function DataTable({
  children,
  minWidth,
  className = "",
}: {
  children: ReactNode;
  minWidth: string;
  className?: string;
}) {
  return (
    <table
      className={`w-full border-collapse text-left text-xs ${minWidth} ${className}`}
    >
      {children}
    </table>
  );
}

export function DataTableHeaderCell<TKey extends string>({
  children,
  sortKey,
  sortState,
  defaultDirection = "asc",
  onSortChange,
  align = "left",
  className = "",
  colSpan,
  rowSpan,
}: {
  children: ReactNode;
  sortKey?: TKey;
  sortState?: DataSortState<TKey> | null;
  defaultDirection?: DataSortDirection;
  onSortChange?: (key: TKey, defaultDirection: DataSortDirection) => void;
  align?: CellAlign;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}) {
  const isSortable = Boolean(sortKey && onSortChange);
  const isActive = Boolean(sortKey && sortState?.key === sortKey);
  const ariaSort = isActive
    ? sortState?.direction === "asc"
      ? "ascending"
      : "descending"
    : undefined;

  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      aria-sort={ariaSort}
      className={`h-8 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-normal ${alignClass[align]} ${className}`}
    >
      {isSortable && sortKey ? (
        <button
          type="button"
          onClick={() => onSortChange?.(sortKey, defaultDirection)}
          className={`inline-flex w-full items-center gap-1 rounded-sm text-[10px] font-semibold uppercase ${
            align === "right"
              ? "justify-end"
              : align === "center"
                ? "justify-center"
                : "justify-start"
          } ${
            isActive
              ? "text-[var(--foreground)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <span>{children}</span>
          <span
            aria-hidden="true"
            className={`min-w-8 text-[9px] ${
              isActive ? "text-[var(--accent)]" : "text-[var(--muted-2)]"
            }`}
          >
            {isActive && sortState
              ? formatDataSortDirection(sortState.direction)
              : ""}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function DataTableCell({
  children,
  align = "left",
  className = "",
  truncate = false,
  title,
}: {
  children: ReactNode;
  align?: CellAlign;
  className?: string;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <td
      className={`h-[var(--table-row-height)] px-2 py-1.5 align-middle text-[11px] text-[var(--muted)] ${alignClass[align]} ${className}`}
    >
      {truncate ? (
        <div className="truncate" title={title}>
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
}

export function DataTableChip({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${chipToneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
