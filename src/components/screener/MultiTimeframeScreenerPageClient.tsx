"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DataTable,
  DataTableCell,
  DataTableChip,
  DataTableHeaderCell,
  DataTableScroll,
  type ChipTone,
} from "@/components/table/DataTable";
import {
  getNextDataSortState,
  sortDataRows,
  type DataSortDirection,
  type DataSortState,
  type DataSortValue,
} from "@/components/table/dataTableSorting";
import {
  ControlGroup,
  EmptyState,
  MetricCard,
  PageHeader,
  PageSection,
  PageShell,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import {
  formatDateTime,
  formatGroupLabel,
} from "@/components/scanner/latestScanUi";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  fetchMarketContext,
  type MarketContextResponse,
} from "@/components/market-context/marketContextUi";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRowsFromResponse,
  buildMtfSymbolResearchHref,
  countMtfResearchBuckets,
  defaultMtfScreenerFilters,
  filterMtfScreenerRowsBySearch,
  filterMtfScreenerRows,
  formatMtfScreenerRowsCsv,
  getMtfCombinedRank,
  formatMtfCombinedRank,
  formatMtfGroup,
  formatMtfRank,
  getMtfScreenerExportFilename,
  getMtfScreenerExportRows,
  getMtfHigherTimeframeHealth,
  getMtfPrimarySignal,
  getMtfRiskNotesSummary,
  getMtfSymbolResearchTimeframe,
  mtfScreenerGroupFilterOptions,
  type MtfLatestScreenerResponse,
  type MtfScreenerFilters,
  type MtfScreenerExportType,
  type MtfScreenerGroupFilter,
  type MtfScreenerPresetId,
  type MtfScreenerRow,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";

const assetClass = "crypto";

export const mtfScreenerProductionCopy = {
  title: "Multi-Timeframe Screener",
  description: "Compare joined scanner signals across 1h, 4h, 1d, and 1w.",
};

export type MtfScreenerTableSortKey =
  | "symbol"
  | "combined_rank"
  | "higher_timeframe_safety"
  | "signal"
  | `${MtfScreenerTimeframe}_group`
  | `${MtfScreenerTimeframe}_rank`;

export function MultiTimeframeScreenerPageClient() {
  const [filters, setFilters] = useState<MtfScreenerFilters>(
    defaultMtfScreenerFilters,
  );
  const [presetId, setPresetId] = useState<MtfScreenerPresetId | "custom">(
    "custom",
  );
  const [symbolSearch, setSymbolSearch] = useState("");
  const [tableSortState, setTableSortState] =
    useState<DataSortState<MtfScreenerTableSortKey> | null>(null);
  const latestQuery = useQuery({
    queryKey: ["mtf-latest-screener", assetClass],
    queryFn: ({ signal }) => fetchMtfLatestScans({ signal }),
    staleTime: 60_000,
  });
  const marketContextQuery = useQuery({
    queryKey: ["market-context", assetClass],
    queryFn: ({ signal }) => fetchMarketContext({ assetClass, signal }),
    retry: false,
    staleTime: 60_000,
  });
  const rows = useMemo(
    () => buildMtfScreenerRowsFromResponse(latestQuery.data),
    [latestQuery.data],
  );
  const filteredRows = useMemo(
    () => filterMtfScreenerRows(rows, filters, presetId),
    [filters, presetId, rows],
  );
  const searchedRows = useMemo(
    () => filterMtfScreenerRowsBySearch(filteredRows, symbolSearch),
    [filteredRows, symbolSearch],
  );
  const visibleRows = useMemo(
    () => sortDataRows(searchedRows, tableSortState, getMtfScreenerTableSortValue),
    [searchedRows, tableSortState],
  );
  const isFullTableActive =
    presetId === "custom" &&
    symbolSearch.trim() === "" &&
    areMtfScreenerFiltersDefault(filters) &&
    tableSortState === null;

  const updateGroupFilter = (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => {
    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      groups: { ...current.groups, [timeframe]: value },
    }));
  };
  const updateMinRank = (timeframe: MtfScreenerTimeframe, value: string) => {
    const parsed = Number(value);

    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      minRank: {
        ...current.minRank,
        [timeframe]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      },
    }));
  };
  const updateExcludeRisk = (key: "exclude1dRisk" | "exclude1wRisk") => {
    setPresetId("custom");
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };
  const updateTableSort = (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setTableSortState((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const applyPreset = (nextPresetId: MtfScreenerPresetId) => {
    setPresetId(nextPresetId);
    setFilters(defaultMtfScreenerFilters);
  };
  const clearFilters = () => {
    setPresetId("custom");
    setFilters(defaultMtfScreenerFilters);
    setSymbolSearch("");
    setTableSortState(null);
  };
  const refreshData = () => {
    void latestQuery.refetch();
    void marketContextQuery.refetch();
  };
  const exportRows = (exportType: MtfScreenerExportType) => {
    const exportedAt = new Date().toISOString();
    const exportRows = getMtfScreenerExportRows({
      exportType,
      visibleRows,
      allRows: rows,
    });
    const csv = formatMtfScreenerRowsCsv({
      rows: exportRows,
      exportType,
      exportedAt,
      assetClass,
      runs: latestQuery.data?.runs,
    });

    downloadCsvFile({
      csv,
      filename: getMtfScreenerExportFilename({ exportType, exportedAt }),
    });
  };

  return (
    <PageShell className="overflow-x-hidden">
      <PageHeader
        eyebrow="Research workspace"
        title={mtfScreenerProductionCopy.title}
        tone="screener"
        description={mtfScreenerProductionCopy.description}
        actions={
          <button
            type="button"
            onClick={refreshData}
            disabled={latestQuery.isFetching || marketContextQuery.isFetching}
            className="ui-button h-8 px-3 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestQuery.isFetching || marketContextQuery.isFetching
              ? "Refreshing"
              : "Refresh"}
          </button>
        }
        metadata={[
          { label: "Dataset", value: "Latest joined rows", tone: "accent" },
          {
            label: "Visible rows",
            value: `${visibleRows.length} of ${rows.length}`,
            tone: visibleRows.length === rows.length ? "complete" : "info",
          },
          {
            label: "Sort",
            value: tableSortState
              ? `${tableSortState.key} ${tableSortState.direction}`
              : "Incoming order",
            tone: tableSortState ? "info" : "neutral",
          },
          {
            label: "Filters",
            value: isFullTableActive ? "Full table" : "Active",
            tone: isFullTableActive ? "complete" : "warning",
          },
        ]}
      />

      <MtfResearchBucketsPanel
        rows={rows}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        onBucketSelect={applyPreset}
        onClear={clearFilters}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[224px_minmax(0,1fr)]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          onSymbolSearchChange={setSymbolSearch}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
          marketContextData={marketContextQuery.data}
          marketContextIsLoading={marketContextQuery.isLoading}
          marketContextIsError={marketContextQuery.isError}
          className="order-2 xl:order-1"
        />

        <main className="order-1 min-w-0 space-y-2 xl:order-2">
          {latestQuery.isLoading ? (
            <MtfStatePanel message="Loading multi-timeframe latest scan data." />
          ) : latestQuery.isError ? (
            <MtfStatePanel message={getMtfErrorMessage(latestQuery.error)} />
          ) : rows.length === 0 ? (
            <MtfStatePanel message="No latest multi-timeframe rows are available yet." />
          ) : (
            <MtfScreenerTable
              rows={visibleRows}
              sortState={tableSortState}
              onSortChange={updateTableSort}
              sourceData={latestQuery.data}
              totalRows={rows.length}
              filteredRows={visibleRows.length}
              onExportVisible={() => exportRows("visible_rows")}
              onExportAll={() => exportRows("all_joined_rows")}
            />
          )}
        </main>
      </div>
    </PageShell>
  );
}

export function MtfScreenerTable({
  rows,
  sortState = null,
  onSortChange,
  sourceData,
  totalRows = rows.length,
  filteredRows = rows.length,
  onExportVisible,
  onExportAll,
}: {
  rows: MtfScreenerRow[];
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  onSortChange?: (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
  sourceData?: MtfLatestScreenerResponse;
  totalRows?: number;
  filteredRows?: number;
  onExportVisible?: () => void;
  onExportAll?: () => void;
}) {
  if (rows.length === 0) {
    return (
      <MtfStatePanel message="No symbols match the selected multi-timeframe filters." />
    );
  }

  return (
    <PageSection
      title="Joined Symbol Table"
      description="Joined scanner signals with local filters and sorting."
      tone="rows"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone="accent" className="text-[11px]">
            Showing {filteredRows} of {totalRows} symbols
          </StatusBadge>
          {onExportVisible && onExportAll ? (
            <MtfScreenerExportControls
              visibleRowsCount={filteredRows}
              allRowsCount={totalRows}
              onExportVisible={onExportVisible}
              onExportAll={onExportAll}
            />
          ) : null}
        </div>
      }
      className="overflow-hidden"
      bodyClassName="p-0"
    >
      {sourceData ? (
        <MtfScreenerFreshnessStrip
          data={sourceData}
          totalRows={totalRows}
          filteredRows={filteredRows}
        />
      ) : null}
      <DataTableScroll>
        <DataTable minWidth="min-w-[1340px]" className="table-fixed">
          <thead className="bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
            <tr>
              <DataTableHeaderCell
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                className="sticky left-0 z-20 w-[126px] bg-[var(--table-header)]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="combined_rank"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                align="right"
                className="w-[72px]"
              >
                Rank
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="higher_timeframe_safety"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="w-[112px]"
              >
                Higher TF
              </DataTableHeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <TimeframeHeaderCells
                  key={timeframe}
                  timeframe={timeframe}
                  sortState={sortState}
                  onSortChange={onSortChange}
                />
              ))}
              <DataTableHeaderCell
                sortKey="signal"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[156px]"
              >
                Signal
              </DataTableHeaderCell>
              <DataTableHeaderCell className="w-[190px]">
                Notes
              </DataTableHeaderCell>
              <DataTableHeaderCell className="w-[104px]">
                Research
              </DataTableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="group border-t border-[var(--border)] align-top odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)]"
              >
                <DataTableCell className="sticky left-0 z-10 bg-inherit group-hover:bg-[var(--row-hover)]">
                  <div className="font-mono text-xs font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
                    {row.exchange} / {row.market}
                  </div>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-mono tabular-nums text-[var(--foreground)]">
                    {formatMtfCombinedRank(row)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <HigherTimeframeHealthBadge row={row} />
                </DataTableCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <TimeframeCells
                    key={`${row.symbol}-${timeframe}`}
                    row={row}
                    timeframe={timeframe}
                  />
                ))}
                <DataTableCell
                  className="max-w-[156px] leading-4 text-[var(--foreground)]"
                  truncate
                  title={getMtfPrimarySignal(row)}
                >
                  {getMtfPrimarySignal(row)}
                </DataTableCell>
                <DataTableCell>
                  <RiskNotesCell row={row} />
                </DataTableCell>
                <DataTableCell>
                  <ResearchLink row={row} />
                </DataTableCell>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </DataTableScroll>
    </PageSection>
  );
}

async function fetchMtfLatestScans({
  signal,
}: {
  signal?: AbortSignal;
}): Promise<MtfLatestScreenerResponse> {
  const response = await fetch(buildMtfLatestScanUrl({ assetClass }), { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to load multi-timeframe latest scan data (${response.status}).`,
    );
  }

  return (await response.json()) as MtfLatestScreenerResponse;
}

export function buildMtfLatestScanUrl({
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    assetClass,
  });
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/scan/mtf-latest?${params.toString()}`;
}

function downloadCsvFile({
  csv,
  filename,
}: {
  csv: string;
  filename: string;
}) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function MtfResearchBucketsPanel({
  rows,
  presetId,
  isFullTableActive,
  onBucketSelect,
  onClear,
}: {
  rows: MtfScreenerRow[];
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
  onBucketSelect: (presetId: MtfScreenerPresetId) => void;
  onClear: () => void;
}) {
  const buckets = countMtfResearchBuckets(rows);

  return (
    <PageSection
      title="Research Buckets"
      description="Counts before filters."
      className="mb-2 min-w-0"
      tone="screener"
      bodyClassName="px-2.5 py-1.5"
      actions={
        <button
          type="button"
          onClick={onClear}
          aria-pressed={isFullTableActive}
          className={`inline-flex min-h-7 items-center gap-2 border px-2 py-1 text-left text-[11px] transition ${
            isFullTableActive
              ? "border-[var(--accent)] bg-[var(--panel)] text-[var(--foreground)] shadow-[inset_0_-2px_0_var(--accent)]"
              : "border-[var(--border)] bg-[var(--control)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="font-semibold">Full Table</span>
          <span className="font-mono tabular-nums">{rows.length}</span>
        </button>
      }
    >
      <div className="grid min-w-0 grid-cols-2 gap-1 lg:grid-cols-5">
        {buckets.map((bucket) => {
          const isActive = presetId === bucket.id;
          const tone = getMtfResearchBucketTone(bucket.id);

          return (
            <button
              key={bucket.id}
              type="button"
              title={`${bucket.label}: ${bucket.description}`}
              onClick={() => onBucketSelect(bucket.id)}
              aria-pressed={isActive}
              className={getMtfResearchBucketButtonClass(tone, isActive)}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--foreground)]">
                  {bucket.label}
                </span>
                <span className={`font-mono text-sm tabular-nums ${getMtfResearchBucketValueClass(tone)}`}>
                  {bucket.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </PageSection>
  );
}

export function MtfScreenerControls({
  filters,
  symbolSearch,
  onSymbolSearchChange,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onClear,
  marketContextData,
  marketContextIsLoading = false,
  marketContextIsError = false,
  className = "",
}: {
  filters: MtfScreenerFilters;
  symbolSearch: string;
  onSymbolSearchChange: (value: string) => void;
  onGroupChange: (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => void;
  onMinRankChange: (timeframe: MtfScreenerTimeframe, value: string) => void;
  onExcludeRiskChange: (key: "exclude1dRisk" | "exclude1wRisk") => void;
  onClear: () => void;
  marketContextData?: MarketContextResponse | null;
  marketContextIsLoading?: boolean;
  marketContextIsError?: boolean;
  className?: string;
}) {
  const activeFilterLabels = getActiveMtfFilterLabels(filters, symbolSearch);

  return (
    <aside className={`border border-[var(--border)] bg-[var(--panel-muted)] p-2 shadow-none xl:h-fit xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-1.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">Filters</h2>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {activeFilterLabels.length === 0
              ? "Full joined dataset"
              : `${activeFilterLabels.length} active`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ui-button h-7 px-2 text-[11px]"
        >
          Clear
        </button>
      </div>

      <ControlGroup>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted)]">
            Symbol Search
          </span>
          <input
            type="search"
            value={symbolSearch}
            onChange={(event) => onSymbolSearchChange(event.target.value)}
            className={controlClass}
            placeholder="BTC, ETH, SEI..."
          />
        </label>
      </ControlGroup>

      {activeFilterLabels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {activeFilterLabels.map((label) => (
            <StatusBadge key={label} tone="info" className="text-[10px]">
              {label}
            </StatusBadge>
          ))}
        </div>
      ) : null}

      <ControlGroup title="Group Filters" className="mt-2">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
          <label key={timeframe} className="block">
            <span className="mb-1 block text-[11px] text-[var(--muted)]">
              {timeframe} group
            </span>
            <select
              value={filters.groups[timeframe]}
              onChange={(event) =>
                onGroupChange(
                  timeframe,
                  event.target.value as MtfScreenerGroupFilter,
                )
              }
              className={controlClass}
            >
              {mtfScreenerGroupFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "any" ? "Any" : formatGroupLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </ControlGroup>

      <ControlGroup title="Minimum Rank" className="mt-2">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
          <label key={timeframe} className="block">
            <span className="mb-1 block text-[11px] text-[var(--muted)]">
              {timeframe} rank
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={filters.minRank[timeframe] || ""}
              onChange={(event) => onMinRankChange(timeframe, event.target.value)}
              className={controlClass}
              placeholder="0"
            />
          </label>
        ))}
      </ControlGroup>

      <ControlGroup title="Risk Exclusions" className="mt-2">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1dRisk}
            onChange={() => onExcludeRiskChange("exclude1dRisk")}
            className="accent-[var(--accent)]"
          />
          Exclude 1d risk
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1wRisk}
            onChange={() => onExcludeRiskChange("exclude1wRisk")}
            className="accent-[var(--accent)]"
          />
          Exclude 1w risk
        </label>
      </ControlGroup>

      <details className="mt-2 border-t border-[var(--border)] pt-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase text-[var(--muted)]">
          Market backdrop
        </summary>
        <MarketContextPanel
          variant="compact"
          data={marketContextData}
          isLoading={marketContextIsLoading}
          isError={marketContextIsError}
          implication="Context only; table rows and classifications stay unchanged."
          className="mt-2 border-l-2 px-2 py-2 shadow-none"
        />
      </details>
    </aside>
  );
}

export function MtfScreenerSourcePanel({
  data,
  totalRows,
  filteredRows,
  onExportVisible,
  onExportAll,
}: {
  data: MtfLatestScreenerResponse | undefined;
  totalRows: number;
  filteredRows: number;
  onExportVisible: () => void;
  onExportAll: () => void;
}) {
  return (
    <PageSection
      title="Data Source / Run Freshness"
      description="Latest selected crypto scanner runs joined across 1h, 4h, 1d, and 1w."
      tone="summary"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone={filteredRows === totalRows ? "complete" : "info"}>
            Showing {filteredRows} of {totalRows} joined symbols
          </StatusBadge>
          <MtfScreenerExportControls
            visibleRowsCount={filteredRows}
            allRowsCount={totalRows}
            onExportVisible={onExportVisible}
            onExportAll={onExportAll}
          />
        </div>
      }
      bodyClassName="px-3 py-2"
    >
      <div className="grid gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const run = data?.runs[timeframe];
          const signalCount = data?.signalCounts[timeframe] ?? 0;
          const missingCount = data?.missingCounts[timeframe] ?? 0;

          return (
            <MetricCard
              key={timeframe}
              label={timeframe}
              value={run ? formatDateTime(run.finishedAt ?? run.startedAt) : "No run"}
              detail={
                run
                  ? `${signalCount} signals, ${missingCount} missing`
                  : "No selected latest run"
              }
              tone={!run ? "missing" : missingCount > 0 ? "warning" : "complete"}
            />
          );
        })}
      </div>
    </PageSection>
  );
}

function MtfScreenerFreshnessStrip({
  data,
  totalRows,
  filteredRows,
}: {
  data: MtfLatestScreenerResponse;
  totalRows: number;
  filteredRows: number;
}) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--panel)] px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="font-semibold text-[var(--foreground)]">
          Showing {filteredRows} of {totalRows} joined symbols
        </span>
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const run = data.runs[timeframe];
          const signalCount = data.signalCounts[timeframe] ?? 0;
          const missingCount = data.missingCounts[timeframe] ?? 0;

          return (
            <span key={timeframe} className="inline-flex min-w-0 items-center gap-1">
              <span className="font-semibold uppercase text-[var(--foreground)]">
                {timeframe}
              </span>
              <span className="truncate">
                {run ? formatDateTime(run.finishedAt ?? run.startedAt) : "No run"}
              </span>
              <span className={missingCount > 0 ? "text-[var(--warning)]" : "text-[var(--muted)]"}>
                {run ? `${signalCount} signals, ${missingCount} missing` : "missing"}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MtfScreenerExportControls({
  visibleRowsCount,
  allRowsCount,
  onExportVisible,
  onExportAll,
}: {
  visibleRowsCount: number;
  allRowsCount: number;
  onExportVisible: () => void;
  onExportAll: () => void;
}) {
  return (
    <div
      aria-label="Screener CSV export"
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        onClick={onExportVisible}
        disabled={visibleRowsCount === 0}
        className="ui-button h-7 px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export Visible Rows
      </button>
      <button
        type="button"
        onClick={onExportAll}
        disabled={allRowsCount === 0}
        className="ui-button h-7 px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export All Joined Rows
      </button>
    </div>
  );
}

function MtfStatePanel({ message }: { message: string }) {
  return (
    <EmptyState title="Screener state" message={message} />
  );
}

export function getMtfScreenerTableSortValue(
  row: MtfScreenerRow,
  key: MtfScreenerTableSortKey,
): DataSortValue {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "combined_rank":
      return getMtfCombinedRank(row);
    case "higher_timeframe_safety":
      return getMtfHigherTimeframeHealth(row).sortRank;
    case "signal":
      return getMtfPrimarySignal(row);
  }

  const rankTimeframe = getMtfTableSortTimeframe(key, "_rank");

  if (rankTimeframe) {
    return row.snapshots[rankTimeframe]?.rankScore ?? null;
  }

  const groupTimeframe = getMtfTableSortTimeframe(key, "_group");

  if (groupTimeframe) {
    return getMtfGroupSortRank(row.snapshots[groupTimeframe]?.resultGroup);
  }

  return null;
}

function getMtfTableSortTimeframe(
  key: MtfScreenerTableSortKey,
  suffix: "_group" | "_rank",
) {
  if (!key.endsWith(suffix)) {
    return null;
  }

  const timeframe = key.slice(0, -suffix.length);

  return MTF_SCREENER_TIMEFRAMES.includes(timeframe as MtfScreenerTimeframe)
    ? (timeframe as MtfScreenerTimeframe)
    : null;
}

function getMtfGroupSortRank(group: string | null | undefined) {
  switch (group) {
    case "eligible":
      return 5;
    case "watch":
      return 4;
    case "neutral":
      return 3;
    case "overheated":
      return 2;
    case "risk":
      return 1;
    case "insufficient_history":
      return 0;
    default:
      return null;
  }
}

function TimeframeHeaderCells({
  timeframe,
  sortState,
  onSortChange,
}: {
  timeframe: MtfScreenerTimeframe;
  sortState: DataSortState<MtfScreenerTableSortKey> | null;
  onSortChange?: (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
}) {
  return (
    <>
      <DataTableHeaderCell
        sortKey={`${timeframe}_group`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        className="w-[86px] border-l border-[var(--border)]"
      >
        {timeframe} Group
      </DataTableHeaderCell>
      <DataTableHeaderCell
        sortKey={`${timeframe}_rank`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        align="right"
        className="w-[64px]"
      >
        {timeframe} Rank
      </DataTableHeaderCell>
    </>
  );
}

function TimeframeCells({
  row,
  timeframe,
}: {
  row: MtfScreenerRow;
  timeframe: MtfScreenerTimeframe;
}) {
  const snapshot = row.snapshots[timeframe];

  return (
    <>
      <DataTableCell className="border-l border-[var(--border)]">
        <GroupBadge group={snapshot?.resultGroup}>{formatMtfGroup(snapshot)}</GroupBadge>
      </DataTableCell>
      <DataTableCell align="right">
        <span className="font-mono tabular-nums text-[var(--foreground)]">
          {formatMtfRank(snapshot)}
        </span>
      </DataTableCell>
    </>
  );
}

function GroupBadge({
  group,
  children,
}: {
  group?: string;
  children: React.ReactNode;
}) {
  return (
    <DataTableChip
      tone={getMtfGroupChipTone(group)}
      className="min-w-[74px] justify-center"
    >
      {children}
    </DataTableChip>
  );
}

function getMtfGroupChipTone(group: string | null | undefined): ChipTone {
  switch (group) {
    case "eligible":
      return "eligible";
    case "watch":
      return "watch";
    case "overheated":
      return "overheated";
    case "risk":
      return "risk";
    default:
      return "neutral";
  }
}

function getMtfResearchBucketTone(id: MtfScreenerPresetId): StatusTone {
  switch (id) {
    case "mtf_strength":
      return "eligible";
    case "short_term_repair":
    case "higher_timeframe_safe_watchlist":
      return "watch";
    case "overheated_caution":
      return "overheated";
    case "breakdown_risk":
      return "risk";
  }
}

function getMtfResearchBucketValueClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--watch)]";
    case "overheated":
      return "text-[var(--overheated)]";
    case "risk":
      return "text-[var(--risk)]";
    default:
      return "text-[var(--foreground)]";
  }
}

function getMtfResearchBucketButtonClass(tone: StatusTone, isActive: boolean) {
  const base =
    "min-h-10 min-w-0 border border-l-2 bg-[var(--panel)] px-2 py-1.5 text-left transition";
  const toneClass = getMtfResearchBucketBorderClass(tone);

  return isActive
    ? `${base} ${toneClass} border-[var(--accent)] bg-[var(--panel)] shadow-[inset_0_-2px_0_var(--accent)]`
    : `${base} ${toneClass} border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]`;
}

function getMtfResearchBucketBorderClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
      return "border-l-[var(--eligible)]";
    case "watch":
      return "border-l-[var(--watch)]";
    case "overheated":
      return "border-l-[var(--overheated)]";
    case "risk":
      return "border-l-[var(--risk)]";
    default:
      return "border-l-[var(--neutral)]";
  }
}

function getHigherTimeframeHealthChipTone(code: string): ChipTone {
  switch (code) {
    case "higher_tf_ok":
      return "positive";
    case "limited_htf_data":
      return "info";
    case "higher_tf_risk":
    case "one_day_risk":
    case "one_week_risk":
      return "danger";
    default:
      return "warning";
  }
}

function HigherTimeframeHealthBadge({ row }: { row: MtfScreenerRow }) {
  const health = getMtfHigherTimeframeHealth(row);
  return (
    <DataTableChip tone={getHigherTimeframeHealthChipTone(health.code)}>
      {health.label}
    </DataTableChip>
  );
}

function RiskNotesCell({ row }: { row: MtfScreenerRow }) {
  const summary = getMtfRiskNotesSummary(row, 2);

  if (summary.notes.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden leading-4">
      {summary.visibleNotes.map((note) => (
        <DataTableChip
          key={note}
          title={note}
          className="max-w-[82px] truncate"
        >
          {note}
        </DataTableChip>
      ))}
      {summary.hiddenCount > 0 ? (
        <DataTableChip
          tone="warning"
          title={summary.hiddenNotes.join("; ")}
          className="shrink-0"
        >
          +{summary.hiddenCount}
        </DataTableChip>
      ) : null}
    </div>
  );
}

function ResearchLink({ row }: { row: MtfScreenerRow }) {
  const timeframe = getMtfSymbolResearchTimeframe(row);

  return (
    <Link
      href={buildMtfSymbolResearchHref({ row, timeframe })}
      className="inline-flex min-w-[82px] justify-center border border-transparent px-1.5 py-1 text-[11px] font-semibold text-[var(--info)] underline-offset-2 hover:border-[var(--border-medium)] hover:bg-[var(--panel)] hover:text-[var(--accent)] hover:underline"
    >
      {timeframe} Research
    </Link>
  );
}

function getMtfErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load multi-timeframe screener data.";
}

export function areMtfScreenerFiltersDefault(filters: MtfScreenerFilters) {
  return (
    MTF_SCREENER_TIMEFRAMES.every(
      (timeframe) =>
        filters.groups[timeframe] === defaultMtfScreenerFilters.groups[timeframe] &&
        filters.minRank[timeframe] === defaultMtfScreenerFilters.minRank[timeframe],
    ) &&
    filters.exclude1dRisk === defaultMtfScreenerFilters.exclude1dRisk &&
    filters.exclude1wRisk === defaultMtfScreenerFilters.exclude1wRisk
  );
}

function getActiveMtfFilterLabels(
  filters: MtfScreenerFilters,
  symbolSearch: string,
) {
  const labels: string[] = [];
  const normalizedSearch = symbolSearch.trim();

  if (normalizedSearch) {
    labels.push(`Search ${normalizedSearch}`);
  }

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const group = filters.groups[timeframe];
    const minRank = filters.minRank[timeframe];

    if (
      group !== defaultMtfScreenerFilters.groups[timeframe] &&
      group !== "any"
    ) {
      labels.push(`${timeframe} ${formatGroupLabel(group)}`);
    }

    if (minRank > 0) {
      labels.push(`${timeframe} rank >= ${minRank}`);
    }
  }

  if (filters.exclude1dRisk) {
    labels.push("Exclude 1d risk");
  }

  if (filters.exclude1wRisk) {
    labels.push("Exclude 1w risk");
  }

  return labels;
}

const controlClass =
  "h-8 w-full border border-[var(--border)] bg-[var(--control)] px-2 text-xs text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] focus:border-[var(--accent)]";
