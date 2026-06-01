export type SymbolResearchGroup =
  | "eligible"
  | "watch"
  | "overheated"
  | "risk"
  | "neutral"
  | "insufficient_history";

const groupLabels = {
  eligible: "Eligible",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
} satisfies Record<SymbolResearchGroup, string>;

const actionLabels: Record<string, string> = {
  eligible: "Manual review",
  watch: "Review only",
  watch_caution: "Caution review",
  watch_low: "Low priority review",
  overheated: "Do not chase",
  risk: "Avoid or wait for repair",
  neutral: "No clear edge",
  insufficient_history: "Not enough candles",
};

type CandleSummaryInput = {
  rows?: Array<{
    openTime: number;
    close: number;
    high: number;
    low: number;
  }>;
};

export function formatSymbolResearchScore(
  value: number | null | undefined,
  decimals = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(decimals);
}

export function formatSymbolResearchPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 6,
  });
}

export function formatSymbolResearchDateTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSymbolResearchGroup(value: string | null | undefined) {
  return isSymbolResearchGroup(value) ? groupLabels[value] : "Unknown";
}

export function formatSymbolResearchAction(value: string | null | undefined) {
  if (!value) {
    return "Review only";
  }

  if (Object.values(actionLabels).includes(value)) {
    return value;
  }

  return actionLabels[value] ?? toTitleCase(value);
}

export function formatSymbolResearchSetup(value: string | null | undefined) {
  return value ? toTitleCase(value) : "Unknown";
}

export function formatSymbolResearchList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? toTitleCase(item) : ""))
    .filter(Boolean);
}

export function getSymbolResearchScoreRows(scores: {
  rankScore?: number | null;
  finalSignalScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  structureScore?: number | null;
}) {
  return [
    { label: "Rank", value: formatSymbolResearchScore(scores.rankScore) },
    { label: "Final Signal", value: formatSymbolResearchScore(scores.finalSignalScore) },
    { label: "Opportunity", value: formatSymbolResearchScore(scores.opportunityScore) },
    { label: "Confirmation", value: formatSymbolResearchScore(scores.confirmationScore) },
    { label: "Risk", value: formatSymbolResearchScore(scores.riskScore) },
    { label: "Trend", value: formatSymbolResearchScore(scores.trendScore) },
    { label: "Momentum", value: formatSymbolResearchScore(scores.momentumScore) },
    { label: "Volume", value: formatSymbolResearchScore(scores.volumeScore) },
    { label: "Structure", value: formatSymbolResearchScore(scores.structureScore) },
  ];
}

export function getSymbolResearchCandleSummary(candles: CandleSummaryInput) {
  const rows = candles.rows ?? [];
  const latest = rows[rows.length - 1] ?? null;
  const high = rows.length > 0 ? Math.max(...rows.map((row) => row.high)) : null;
  const low = rows.length > 0 ? Math.min(...rows.map((row) => row.low)) : null;

  return {
    latestClose: latest?.close ?? null,
    recentHigh: Number.isFinite(high) ? high : null,
    recentLow: Number.isFinite(low) ? low : null,
  };
}

export function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isSymbolResearchGroup(value: unknown): value is SymbolResearchGroup {
  return (
    value === "eligible" ||
    value === "watch" ||
    value === "overheated" ||
    value === "risk" ||
    value === "neutral" ||
    value === "insufficient_history"
  );
}
