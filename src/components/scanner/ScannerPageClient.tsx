"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import type { Timeframe } from "@/lib/exchanges/types";
import type {
  MarketPhase,
  ScannerSignalState,
  ScanResult,
} from "@/lib/scanner/types";

type ScanApiResponse = {
  exchange: "binance";
  timeframe: Timeframe;
  results: ScanResult[];
  itemCount: number;
  errors?: { symbol: string; message: string }[];
  cached: boolean;
  updatedAt: string;
};

export type ScannerFiltersState = {
  timeframe: Timeframe;
  signal: ScannerSignalState | "ALL";
  phase: MarketPhase | "ALL";
  minOpportunityScore: number;
  maxRiskScore: number;
  sortBy: ScannerSortKey;
  limit: 50 | 100 | 200;
};

const initialFilters: ScannerFiltersState = {
  timeframe: "4h",
  signal: "ALL",
  phase: "ALL",
  minOpportunityScore: 0,
  maxRiskScore: 100,
  sortBy: "rankScore",
  limit: 50,
};

export function ScannerPageClient() {
  const [filters, setFilters] = useState<ScannerFiltersState>(initialFilters);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const scanQuery = useQuery({
    queryKey: ["scan", filters.timeframe, filters.limit],
    queryFn: () => fetchScan(filters.timeframe, filters.limit),
  });
  const rows = useMemo(
    () => filterAndSortResults(scanQuery.data?.results ?? [], filters),
    [scanQuery.data?.results, filters],
  );
  const selectedResult =
    rows.find((row) => row.symbol === selectedSymbol) ?? rows[0] ?? null;

  function updateFilters(nextFilters: ScannerFiltersState) {
    setFilters(nextFilters);
    setSelectedSymbol(null);
  }

  return (
    <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
      <ScannerFilters filters={filters} onChange={updateFilters} />
      <ScannerTable
        rows={rows}
        selectedSymbol={selectedResult?.symbol ?? null}
        isLoading={scanQuery.isLoading}
        isFetching={scanQuery.isFetching}
        isError={scanQuery.isError}
        errorMessage={
          scanQuery.error instanceof Error
            ? scanQuery.error.message
            : "Unable to load scanner results."
        }
        cached={scanQuery.data?.cached ?? false}
        updatedAt={scanQuery.data?.updatedAt ?? null}
        sourceItemCount={scanQuery.data?.itemCount ?? 0}
        partialErrors={scanQuery.data?.errors ?? []}
        onRefresh={() => void scanQuery.refetch()}
        onSelect={setSelectedSymbol}
      />
      <SelectedSymbolPanel result={selectedResult} />
    </section>
  );
}

async function fetchScan(timeframe: Timeframe, limit: number) {
  const params = new URLSearchParams({
    timeframe,
    limit: String(limit),
  });
  const response = await fetch(`/api/scan?${params.toString()}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "Scanner request failed.",
    );
  }

  return (await response.json()) as ScanApiResponse;
}

export function filterAndSortResults(
  results: ScanResult[],
  filters: ScannerFiltersState,
) {
  const filtered = results.filter((result) => {
    return (
      (filters.signal === "ALL" || result.signal.state === filters.signal) &&
      (filters.phase === "ALL" || result.phase === filters.phase) &&
      result.opportunityScore >= filters.minOpportunityScore &&
      result.riskScore <= filters.maxRiskScore
    );
  });

  return filtered.sort((left, right) => {
    switch (filters.sortBy) {
      case "opportunityScore":
        return right.opportunityScore - left.opportunityScore;
      case "confirmationScore":
        return right.confirmationScore - left.confirmationScore;
      case "lowestRiskScore":
        return left.riskScore - right.riskScore;
      case "rankScore":
      default:
        return right.rankScore - left.rankScore;
    }
  });
}
