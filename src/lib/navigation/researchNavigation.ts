export const RESEARCH_NAVIGATION_SOURCES = [
  "rankings",
  "screener",
  "watchlist",
  "archive",
] as const;

export type ResearchNavigationSource =
  (typeof RESEARCH_NAVIGATION_SOURCES)[number];

export const SYMBOL_RESEARCH_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
export type SymbolResearchTimeframe =
  (typeof SYMBOL_RESEARCH_TIMEFRAMES)[number];

export const DEFAULT_SYMBOL_RESEARCH_TIMEFRAME: SymbolResearchTimeframe = "4h";

export type ResearchNavigationQueryState =
  | { get(name: string): string | null }
  | Record<string, string | string[] | number | boolean | null | undefined>
  | null
  | undefined;

export type ResearchNavigationContext = {
  timeframe?: string | null;
  assetClass?: string | null;
  group?: string | null;
  risk?: string | null;
  sort?: string | null;
  q?: string | null;
  runId?: string | null;
  snapshotId?: string | null;
  symbol?: string | null;
  includeLowQuality?: boolean | string | null;
  limit?: number | string | null;
};

export type SymbolResearchHrefParams = ResearchNavigationContext & {
  exchange?: string | null;
  symbol: string;
  from?: string | null;
};

export type SymbolResearchTimeframeSelection = {
  requestedTimeframe: string | null;
  selectedTimeframe: SymbolResearchTimeframe;
  fallbackReason: "missing" | "invalid" | null;
};

export type ResearchReturnLink = {
  href: string;
  label: string;
  source: ResearchNavigationSource;
};

type RouteContextKey =
  | "timeframe"
  | "assetClass"
  | "group"
  | "risk"
  | "sort"
  | "q"
  | "runId"
  | "snapshotId"
  | "symbol";

const standardContextKeys: RouteContextKey[] = [
  "timeframe",
  "assetClass",
  "group",
  "risk",
  "sort",
  "q",
  "runId",
  "snapshotId",
  "symbol",
];

export function buildSymbolResearchHref({
  exchange,
  symbol,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  from,
  group,
  risk,
  sort,
  q,
  runId,
  snapshotId,
}: SymbolResearchHrefParams) {
  const params = new URLSearchParams({
    timeframe: normalizeSymbolResearchTimeframe(timeframe),
  });
  const normalizedAssetClass = normalizeOptionalParam(assetClass);
  const normalizedLimit = normalizePositiveInteger(limit);
  const normalizedFrom = normalizeResearchNavigationSource(from);

  if (normalizedAssetClass) {
    params.set("assetClass", normalizedAssetClass);
  }

  if (includeLowQuality === true || includeLowQuality === "true") {
    params.set("includeLowQuality", "true");
  }

  if (normalizedLimit !== null) {
    params.set("limit", String(normalizedLimit));
  }

  if (normalizedFrom) {
    params.set("from", normalizedFrom);
  }

  appendOptionalParam(params, "group", group);
  appendOptionalParam(params, "risk", risk);
  appendOptionalParam(params, "sort", sort);
  appendOptionalParam(params, "q", q);
  appendOptionalParam(params, "runId", runId);
  appendOptionalParam(params, "snapshotId", snapshotId);

  return buildPath(
    `/symbol/${encodeURIComponent(
      normalizeExchangePathSegment(exchange),
    )}/${encodeURIComponent(normalizeSymbolResearchInputSymbol(symbol))}`,
    params,
  );
}

export function buildRankingsHref(context: ResearchNavigationContext = {}) {
  const params = new URLSearchParams();
  const timeframe = context.timeframe
    ? normalizeSymbolResearchTimeframe(context.timeframe)
    : null;
  const limit = normalizePositiveInteger(context.limit);

  appendOptionalParam(params, "timeframe", timeframe);
  appendOptionalParam(params, "assetClass", context.assetClass);
  appendOptionalParam(params, "group", context.group);
  appendOptionalParam(params, "risk", context.risk);
  appendOptionalParam(params, "sort", context.sort);
  appendOptionalParam(params, "q", context.q);

  if (context.includeLowQuality === true || context.includeLowQuality === "true") {
    params.set("includeLowQuality", "true");
  }

  if (limit !== null) {
    params.set("limit", String(limit));
  }

  return buildPath("/rankings", params);
}

export function buildScreenerHref(context: ResearchNavigationContext = {}) {
  const params = new URLSearchParams();
  const timeframe = context.timeframe
    ? normalizeSymbolResearchTimeframe(context.timeframe)
    : null;

  appendOptionalParam(params, "assetClass", context.assetClass);
  appendOptionalParam(params, "timeframe", timeframe);
  appendOptionalParam(params, "group", context.group);
  appendOptionalParam(params, "risk", context.risk);
  appendOptionalParam(params, "sort", context.sort);
  appendOptionalParam(params, "q", context.q);

  return buildPath("/screener", params);
}

export function buildWatchlistHref(context: ResearchNavigationContext = {}) {
  const params = new URLSearchParams();

  appendOptionalParam(params, "assetClass", context.assetClass);
  appendOptionalParam(params, "group", context.group);
  appendOptionalParam(params, "risk", context.risk);
  appendOptionalParam(params, "sort", context.sort);
  appendOptionalParam(params, "q", context.q);
  appendOptionalParam(params, "symbol", context.symbol);

  return buildPath("/watchlist", params);
}

export function buildArchiveHref(context: ResearchNavigationContext = {}) {
  const params = new URLSearchParams();
  const timeframe = context.timeframe
    ? normalizeSymbolResearchTimeframe(context.timeframe)
    : null;

  appendOptionalParam(params, "timeframe", timeframe);
  appendOptionalParam(params, "assetClass", context.assetClass);
  appendOptionalParam(params, "runId", context.runId);
  appendOptionalParam(params, "snapshotId", context.snapshotId);
  appendOptionalParam(params, "symbol", context.symbol);

  return buildPath("/archive", params);
}

export function buildSourceAwareResearchReturnLink(
  searchParamsOrState?: ResearchNavigationQueryState,
  fallback?: ResearchNavigationContext,
): ResearchReturnLink | null {
  const source = normalizeResearchNavigationSource(
    getNavigationQueryValue(searchParamsOrState, "from"),
  );

  if (!source) {
    return null;
  }

  const context = getResearchNavigationContext(searchParamsOrState, fallback);

  switch (source) {
    case "rankings":
      return {
        source,
        label: "Back to Rankings",
        href: buildRankingsHref(context),
      };
    case "screener":
      return {
        source,
        label: "Back to Screener",
        href: buildScreenerHref(context),
      };
    case "watchlist":
      return {
        source,
        label: "Back to Watchlist",
        href: buildWatchlistHref(context),
      };
    case "archive":
      return {
        source,
        label: "Back to Archive",
        href: buildArchiveHref(context),
      };
  }
}

export function buildDefaultResearchReturnLink(
  context: ResearchNavigationContext = {},
): ResearchReturnLink {
  return {
    source: "rankings",
    label: "Back to Rankings",
    href: buildRankingsHref(context),
  };
}

export function getResearchNavigationContext(
  searchParamsOrState?: ResearchNavigationQueryState,
  fallback: ResearchNavigationContext = {},
): ResearchNavigationContext {
  const context: ResearchNavigationContext = {};

  for (const key of standardContextKeys) {
    context[key] =
      getNavigationQueryValue(searchParamsOrState, key) ??
      fallback[key] ??
      undefined;
  }

  context.includeLowQuality =
    getNavigationQueryValue(searchParamsOrState, "includeLowQuality") ??
    fallback.includeLowQuality ??
    undefined;
  context.limit =
    getNavigationQueryValue(searchParamsOrState, "limit") ??
    fallback.limit ??
    undefined;

  return context;
}

export function getSymbolResearchTimeframeSelection(
  value: string | null | undefined,
): SymbolResearchTimeframeSelection {
  const requestedTimeframe = value?.trim() || null;

  if (!requestedTimeframe) {
    return {
      requestedTimeframe: null,
      selectedTimeframe: DEFAULT_SYMBOL_RESEARCH_TIMEFRAME,
      fallbackReason: "missing",
    };
  }

  const selectedTimeframe = normalizeSymbolResearchTimeframe(requestedTimeframe);

  return {
    requestedTimeframe,
    selectedTimeframe,
    fallbackReason:
      selectedTimeframe === requestedTimeframe.toLowerCase() ? null : "invalid",
  };
}

export function normalizeSymbolResearchTimeframe(
  value: string | null | undefined,
): SymbolResearchTimeframe {
  const normalized = value?.trim().toLowerCase();

  return isSymbolResearchTimeframe(normalized)
    ? normalized
    : DEFAULT_SYMBOL_RESEARCH_TIMEFRAME;
}

export function isSymbolResearchTimeframe(
  value: string | null | undefined,
): value is SymbolResearchTimeframe {
  return SYMBOL_RESEARCH_TIMEFRAMES.includes(value as SymbolResearchTimeframe);
}

export function normalizeResearchNavigationSource(
  value: string | null | undefined,
): ResearchNavigationSource | null {
  const normalized = value?.trim().toLowerCase();

  return RESEARCH_NAVIGATION_SOURCES.includes(
    normalized as ResearchNavigationSource,
  )
    ? (normalized as ResearchNavigationSource)
    : null;
}

export function getNavigationQueryValue(
  input: ResearchNavigationQueryState,
  key: string,
) {
  if (!input) {
    return null;
  }

  if ("get" in input && typeof input.get === "function") {
    return input.get(key);
  }

  const record = input as Record<
    string,
    string | string[] | number | boolean | null | undefined
  >;
  const value = record[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value === null || value === undefined ? null : String(value);
}

function buildPath(pathname: string, params: URLSearchParams) {
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

function appendOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  const normalizedValue = normalizeOptionalParam(value);

  if (normalizedValue) {
    params.set(key, normalizedValue);
  }
}

function normalizeOptionalParam(
  value: string | number | boolean | null | undefined,
) {
  const normalized = value === null || value === undefined ? "" : String(value).trim();

  return normalized || null;
}

function normalizeSymbolResearchInputSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeExchangePathSegment(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "binance";
}

function normalizePositiveInteger(value: number | string | null | undefined) {
  const number = typeof value === "string" ? Number(value.trim()) : Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}
