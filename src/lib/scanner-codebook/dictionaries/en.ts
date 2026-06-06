import {
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "@/lib/scanner-codebook/codeRegistry";
import type { ScannerCodeDictionary } from "@/lib/scanner-codebook/codeTypes";

export const generatedEnglishBaselineScannerCodeEntries = Object.fromEntries(
  Object.values(scannerCodeRegistry).map((metadata) => [
    metadata.code,
    {
      label: toTitleCase(metadata.internalName),
      short: "Scanner condition code.",
    },
  ]),
) as Record<ActiveScannerCode, { label: string; short: string }>;

export const manualEnglishScannerCodeEntries = {
  GR_001: {
    label: "Neutral",
    short: "No strong scanner edge is present.",
  },
  GR_101: {
    label: "Watch",
    short: "Worth monitoring, but confirmation is incomplete.",
  },
  GR_201: {
    label: "Eligible",
    short: "Candidate is eligible for manual review.",
  },
  GR_301: {
    label: "Overheated",
    short: "Move is extended; avoid chasing without a reset.",
  },
  GR_302: {
    label: "Risk",
    short: "Risk conditions dominate the scanner read.",
  },
  GR_401: {
    label: "Insufficient History",
    short: "Not enough candles are available for a reliable scanner read.",
  },
  AC_001: {
    label: "Low Priority",
    short: "No immediate action is suggested by the scanner.",
  },
  AC_101: {
    label: "Low Priority Review",
    short: "Review only if broader context improves.",
  },
  AC_201: {
    label: "Needs Confirmation",
    short: "Wait for confirmation before treating this as actionable.",
  },
  AC_301: {
    label: "Overheated Review",
    short: "Do not chase while extension risk is elevated.",
  },
  AC_302: {
    label: "Risk Review",
    short: "Risk controls should dominate any review.",
  },
  AC_501: {
    label: "Manual Review",
    short: "Candidate is suitable for manual research review.",
  },
  NX_001: {
    label: "Neutral",
    short: "The scanner does not show a clear edge.",
  },
  NX_101: {
    label: "Mixed Research Context",
    short: "Signals are mixed and should be treated as research context.",
  },
  NX_201: {
    label: "Caution",
    short: "Proceed carefully; the scanner needs more confirmation.",
  },
  NX_302: {
    label: "Execution Noise",
    short: "The setup may be vulnerable to noisy execution conditions.",
  },
  NX_801: {
    label: "Unknown",
    short: "No explanation is available for this code yet.",
  },
  PX_101: {
    label: "Weak Bounce",
    short: "Bounce quality is weak relative to risk.",
  },
  PX_201: {
    label: "Breakout Attempt",
    short: "Price is attempting to break out, but confirmation is not complete.",
  },
  PX_303: {
    label: "Breakdown",
    short: "Structure has broken lower.",
  },
  PX_305: {
    label: "Failed Breakout",
    short: "A breakout attempt has failed or is at risk of failing.",
  },
  PX_501: {
    label: "Breakout Confirmed",
    short: "Breakout structure is confirmed by the scanner.",
  },
  PX_502: {
    label: "Pullback Retest",
    short: "Price is retesting a prior structure area.",
  },
  PX_503: {
    label: "Range Reclaim",
    short: "Price is reclaiming a prior range.",
  },
  PX_604: {
    label: "Squeeze Breakout",
    short: "Compression is resolving into a breakout setup.",
  },
  ST_001: {
    label: "Neutral",
    short: "No specific setup structure is active.",
  },
  ST_201: {
    label: "Base Building",
    short: "Price is building a base rather than trending clearly.",
  },
  ST_202: {
    label: "Short-Term Retest",
    short: "Short-term structure is in a retest state.",
  },
  ST_301: {
    label: "Overextended",
    short: "Price is extended relative to nearby trend support.",
  },
  ST_302: {
    label: "Distribution",
    short: "Structure shows distribution risk.",
  },
  ST_501: {
    label: "Healthy Pullback",
    short: "Pullback remains constructive by scanner criteria.",
  },
  ST_502: {
    label: "Trend Continuation",
    short: "Trend continuation structure remains constructive.",
  },
  ST_503: {
    label: "Trend Repair",
    short: "Trend structure is repairing after weakness.",
  },
  TR_202: {
    label: "Daily Trend",
    short: "Higher-timeframe trend context is constructive.",
  },
  TR_504: {
    label: "Long-Term Repair",
    short: "Longer-term structure is repairing.",
  },
  TR_601: {
    label: "Strong Trend",
    short: "Trend structure is strong.",
  },
  RK_201: {
    label: "Detected Risks",
    short: "One or more risk conditions were detected.",
  },
  RK_301: {
    label: "Overheat Risk",
    short: "Extension or momentum conditions are elevated.",
  },
  RK_302: {
    label: "Distribution Risk",
    short: "Volume or candle structure suggests distribution risk.",
  },
  RK_303: {
    label: "Weak Bounce Risk",
    short: "Bounce structure is weak and may fail.",
  },
  RK_304: {
    label: "Trend Breakdown Risk",
    short: "Trend structure is breaking down.",
  },
  RK_305: {
    label: "Failed Breakout Risk",
    short: "Breakout failure risk is elevated.",
  },
  QH_001: {
    label: "Normal",
    short: "Quality is normal for scanner display.",
  },
  QH_101: {
    label: "Low Quality",
    short: "Quality is below preferred scanner standards.",
  },
  QH_201: {
    label: "Insufficient History",
    short: "Historical candle depth is insufficient.",
  },
  QH_202: {
    label: "New Listing",
    short: "Listing history is limited.",
  },
  QH_501: {
    label: "Major",
    short: "Symbol has major-market quality.",
  },
  QH_601: {
    label: "Core",
    short: "Symbol has core-market quality.",
  },
  VL_104: {
    label: "Weak Volume",
    short: "Volume or liquidity context is weak.",
  },
  VL_304: {
    label: "Liquidity Spike Risk",
    short: "Liquidity spike risk is elevated.",
  },
  VL_601: {
    label: "Volume Supports Upside",
    short: "Volume supports the constructive scanner read.",
  },
} satisfies ScannerCodeDictionary;

export const enScannerCodeDictionary = {
  ...generatedEnglishBaselineScannerCodeEntries,
  ...manualEnglishScannerCodeEntries,
} satisfies ScannerCodeDictionary;

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
