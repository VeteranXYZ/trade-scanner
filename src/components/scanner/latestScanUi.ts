export const latestScanGroupOrder = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type LatestScanGroupKey = (typeof latestScanGroupOrder)[number];

const groupLabels = {
  eligible: "Eligible",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
} satisfies Record<LatestScanGroupKey, string>;

const groupHints = {
  eligible: "Candidate worth further manual review.",
  watch: "Monitor, confirmation needed.",
  overheated: "Do not chase.",
  risk: "Avoid or wait for repair.",
  neutral: "No clear edge.",
  insufficient_history: "Not enough candles.",
} satisfies Record<LatestScanGroupKey, string>;

const signalLabels: Record<string, string> = {
  confirmed: "Confirmed",
  watch: "Watch",
  trend: "Trend",
  overheated: "Overheated",
  distribution_risk: "Distribution Risk",
  weak_bounce: "Weak Bounce",
  breakdown_risk: "Breakdown Risk",
  weak: "Weak",
  neutral: "Neutral",
};

const actionLabels: Record<string, string> = {
  eligible: "Eligible",
  watch_only: "Watch Only",
  do_not_chase: "Do Not Chase",
  avoid: "Avoid",
  ignore: "Ignore",
};

const qualityLabels: Record<string, string> = {
  core: "Core",
  major: "Major",
  normal: "Normal",
  new_listing: "New Listing",
  meme: "Meme",
  fan_token: "Fan Token",
  wrapped_or_staked: "Wrapped/Staked",
  stable_like: "Stable-Like",
  special_or_suspicious: "Special/Suspicious",
  low_history: "Low History",
};

export function formatScore(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(decimals);
}

export function formatPrice(value: number | null | undefined) {
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

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
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

export function formatGroupLabel(group: LatestScanGroupKey) {
  return groupLabels[group];
}

export function formatGroupHint(group: LatestScanGroupKey) {
  return groupHints[group];
}

export function formatSignalLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return signalLabels[value] ?? toTitleCase(value);
}

export function formatActionBias(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return actionLabels[value] ?? toTitleCase(value);
}

export function formatQualityTier(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return qualityLabels[value] ?? toTitleCase(value);
}

export function getResultGroupSortOrder(group: string | null | undefined) {
  const normalized = normalizeGroupKey(group);
  const index = latestScanGroupOrder.indexOf(normalized);

  return index === -1 ? latestScanGroupOrder.length : index;
}

export function normalizeGroupKey(
  group: string | null | undefined,
): LatestScanGroupKey {
  return group === "insufficientHistory" || group === "insufficient_history"
    ? "insufficient_history"
    : latestScanGroupOrder.includes(group as LatestScanGroupKey)
      ? (group as LatestScanGroupKey)
      : "neutral";
}

export function toTitleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\//g, " / ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
