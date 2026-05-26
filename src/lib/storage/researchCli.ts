import type { EvaluationHorizon } from "./scanEvaluation";
import { TIMEFRAMES, type Timeframe } from "@/lib/shared/timeframes";

export const SUPPORTED_EVALUATION_HORIZONS: EvaluationHorizon[] = [
  "1h",
  "4h",
  "24h",
  "3d",
  "7d",
];

const MAX_LIMIT = 500;
const DEFAULT_EVALUATION_LIMIT = 100;
const DEFAULT_INSPECT_LIMIT = 20;

type ParsedFlags = Record<string, string | boolean>;

export type ResearchCommand =
  | "migrate"
  | "evaluate"
  | "prune"
  | "stats"
  | "inspect";

export type ResearchEvaluateCliOptions = {
  horizon: EvaluationHorizon;
  timeframe?: Timeframe;
  limit: number;
  dryRun: boolean;
};

export type ResearchPruneCliOptions = {
  signalDays: number;
  snapshotDays: number;
  evaluationDays: number;
  dryRun: boolean;
};

export type ResearchInspectCliOptions = {
  symbol?: string;
  timeframe?: Timeframe;
  label?: string;
  risk?: string;
  limit: number;
};

export function parseResearchCommand(value: string | undefined) {
  if (
    value === "migrate" ||
    value === "evaluate" ||
    value === "prune" ||
    value === "stats" ||
    value === "inspect"
  ) {
    return value;
  }

  throw new Error(
    "Research command must be one of migrate, evaluate, prune, stats, or inspect.",
  );
}

export function parseEvaluateOptions(args: string[]): ResearchEvaluateCliOptions {
  const flags = parseFlags(args);
  const horizon = parseHorizon(flags.horizon, "24h");
  const timeframe = parseTimeframe(flags.timeframe);
  const limit = parseLimit(flags.limit, DEFAULT_EVALUATION_LIMIT);

  return {
    horizon,
    timeframe,
    limit,
    dryRun: Boolean(flags["dry-run"]),
  };
}

export function parsePruneOptions(args: string[]): ResearchPruneCliOptions {
  const flags = parseFlags(args);

  return {
    signalDays: parseDays(flags["signal-days"], 30, "signal-days"),
    snapshotDays: parseDays(flags["snapshot-days"], 30, "snapshot-days"),
    evaluationDays: parseDays(flags["evaluation-days"], 90, "evaluation-days"),
    dryRun: flags["dry-run"] ? true : flags.execute ? false : true,
  };
}

export function parseInspectOptions(args: string[]): ResearchInspectCliOptions {
  const flags = parseFlags(args);

  return {
    symbol: typeof flags.symbol === "string" ? flags.symbol.toUpperCase() : undefined,
    timeframe: parseTimeframe(flags.timeframe),
    label: typeof flags.label === "string" ? flags.label : undefined,
    risk: typeof flags.risk === "string" ? flags.risk : undefined,
    limit: parseLimit(flags.limit, DEFAULT_INSPECT_LIMIT),
  };
}

function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = {};

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(`Unsupported argument "${arg}". Use --name=value flags.`);
    }

    const [rawName, ...rawValue] = arg.slice(2).split("=");
    flags[rawName] = rawValue.length === 0 ? true : rawValue.join("=");
  }

  return flags;
}

function parseHorizon(value: string | boolean | undefined, fallback: EvaluationHorizon) {
  const horizon = value === undefined ? fallback : value;

  if (
    typeof horizon !== "string" ||
    !SUPPORTED_EVALUATION_HORIZONS.includes(horizon as EvaluationHorizon)
  ) {
    throw new Error("horizon must be one of 1h, 4h, 24h, 3d, or 7d.");
  }

  return horizon as EvaluationHorizon;
}

function parseTimeframe(value: string | boolean | undefined) {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !TIMEFRAMES.includes(value as Timeframe)) {
    throw new Error(`timeframe must be one of ${TIMEFRAMES.join(", ")}.`);
  }

  return value as Timeframe;
}

function parseLimit(value: string | boolean | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }

  return parsed;
}

function parseDays(value: string | boolean | undefined, fallback: number, name: string) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}
