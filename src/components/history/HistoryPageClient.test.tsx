import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildHistoricalSnapshotObservationsUrl,
  buildHistoricalSnapshotUrl,
  buildHistoricalSnapshotsUrl,
  ForwardObservationSection,
  formatHistoryDateTime,
  formatHistoryPrimarySignal,
  HistoryPageClient,
  SnapshotTable,
} from "./HistoryPageClient";

describe("HistoryPageClient API URLs", () => {
  it("uses the public trade API historical snapshot endpoints", () => {
    const runId = "fcc05284-c7a0-4990-9bcb-5dd165d83c37";

    expect(
      buildHistoricalSnapshotsUrl({
        timeframe: "4h",
        assetClass: "crypto",
        limit: 25,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      "https://api.auere.com/api/history/snapshots?timeframe=4h&assetClass=crypto&limit=25",
    );
    expect(
      buildHistoricalSnapshotUrl({
        runId,
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      `https://api.auere.com/api/history/snapshot?runId=${runId}&assetClass=crypto`,
    );
    expect(
      buildHistoricalSnapshotObservationsUrl({
        runId,
        assetClass: "crypto",
        window: 3,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      `https://api.auere.com/api/history/snapshot-observations?runId=${runId}&assetClass=crypto&window=3`,
    );
  });
});

describe("HistoryPageClient display formatting", () => {
  it("renders Historical Research and research-only copy", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(HistoryPageClient),
      ),
    );

    expect(html).toContain("Historical Research");
    expect(html).toContain("Research-only. Not financial advice.");
    expect(html).toContain("Historical observations are not predictions.");
  });

  it("formats dates deterministically without browser locale text", () => {
    const formatted = formatHistoryDateTime("2026-06-02T08:05:00.000Z");

    expect(formatted).toBe("2026-06-02 08:05");
    expect(formatted).not.toContain("2026年");
    expect(formatHistoryDateTime(null)).toBe("Not available");
  });

  it("maps action-like History labels to safer research wording", () => {
    expect(formatHistoryPrimarySignal("Do not chase")).toBe(
      "Overheated caution",
    );
    expect(formatHistoryPrimarySignal("Avoid")).toBe("Risk review");
    expect(formatHistoryPrimarySignal("Manual review")).toBe("Manual review");
  });

  it("renders safer History table labels and preserves full row count copy", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          makeHistoryRow({
            id: "overheated-row",
            symbol: "HOTUSDT",
            primarySignal: "Do not chase",
          }),
          makeHistoryRow({
            id: "risk-row",
            symbol: "RISKUSDT",
            primarySignal: "Avoid",
          }),
        ],
      }),
    );

    expect(html).toContain("Snapshot Rows");
    expect(html).toContain("Full stored single-timeframe result set");
    expect(html).toContain("2 rows");
    expect(html).toContain("Overheated caution");
    expect(html).toContain("Risk review");
    expect(html).not.toContain("Do not chase");
    expect(html).not.toContain("Avoid");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
  });

  it("renders Forward Observation with neutral copy and full row visibility", () => {
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: makeObservationResponse(),
        isLoading: false,
        isFetching: false,
        error: null,
      }),
    );

    expect(html).toContain("Forward Observation");
    expect(html).toContain("Research-only. Historical observations are not predictions.");
    expect(html).toContain("1 candle");
    expect(html).toContain("3 candles");
    expect(html).toContain("5 candles");
    expect(html).toContain("10 candles");
    expect(html).toContain("Selected Window");
    expect(html).toContain("Complete");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing");
    expect(html).toContain("Observed Change");
    expect(html).toContain("Max Drawdown");
    expect(html).toContain("Data Status");
    expect(html).toContain("SEIUSDT");
    expect(html).toContain("RISKUSDT");
    expect(html).toContain("NEWUSDT");
    expect(html).toContain("Insufficient future candles");
    expect(html).not.toContain("Observed Return");
    expect(html).not.toContain("Win rate");
    expect(html).not.toContain("Accuracy");
    expect(html).not.toContain("Worked");
    expect(html).not.toContain("Buy");
    expect(html).not.toContain("Sell");
    expect(html).not.toContain("Prediction");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
    expect(html).not.toContain("top-100");
  });
});

function makeHistoryRow(overrides: {
  id: string;
  symbol: string;
  primarySignal: string;
}) {
  return {
    id: overrides.id,
    scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h" as const,
    group: "risk",
    label: "breakdown_risk",
    primarySignal: overrides.primarySignal,
    riskNotes: null,
    riskTypes: [],
    rankScore: 12,
    componentScores: {
      opportunityScore: 10,
      confirmationScore: 20,
      riskScore: 80,
      trendScore: 15,
      momentumScore: 25,
    },
    scannerVersion: "test",
    scoringVersion: "test",
  };
}

function makeObservationResponse() {
  return {
    ok: true,
    run: {
      runId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
      timeframe: "4h" as const,
      status: "success" as const,
      symbolsScanned: 409,
      signalsCreated: 409,
      finishedAt: "2026-06-02T08:05:00.000Z",
    },
    metadata: {
      window: 3 as const,
      selectedWindow: 3 as const,
      windowUnit: "completed_candles" as const,
      rowCount: 3,
      completeCount: 1,
      partialCount: 1,
      missingCount: 1,
      limited: false,
      timeframe: "4h" as const,
      assetClass: "crypto",
      disclaimer:
        "Research-only. Not financial advice. Historical observations are not predictions.",
    },
    rows: [
      makeObservationRow({
        id: "complete-row",
        symbol: "SEIUSDT",
        dataStatus: "complete",
        missingReason: null,
      }),
      makeObservationRow({
        id: "partial-row",
        symbol: "RISKUSDT",
        dataStatus: "partial",
        missingReason: "insufficient_future_candles",
      }),
      makeObservationRow({
        id: "missing-row",
        symbol: "NEWUSDT",
        observedClose: null,
        observedChangePct: null,
        maxDrawdownPct: null,
        dataStatus: "missing",
        missingReason: "no_future_candles",
      }),
    ],
  };
}

function makeObservationRow(overrides: {
  id: string;
  symbol: string;
  observedClose?: number | null;
  observedChangePct?: number | null;
  maxDrawdownPct?: number | null;
  dataStatus: "complete" | "partial" | "missing";
  missingReason: string | null;
}) {
  return {
    id: overrides.id,
    scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h" as const,
    group: "risk",
    label: "breakdown_risk",
    primarySignal: "Risk review",
    rankScore: 12,
    anchorTime: "2026-06-02T00:00:00.000Z",
    anchorClose: 100,
    anchorSource: "stored_signal" as const,
    window: 3 as const,
    observedClose: overrides.observedClose ?? 102,
    observedChangePct: overrides.observedChangePct ?? 2,
    maxDrawdownPct: overrides.maxDrawdownPct ?? -3,
    dataStatus: overrides.dataStatus,
    missingReason: overrides.missingReason,
  };
}
