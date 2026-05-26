import type { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScannerExplanation } from "@/lib/shared/scannerTypes";

type Dictionary = ReturnType<typeof useLanguage>["dictionary"];

export function formatScannerExplanation(
  explanation: ScannerExplanation,
  t: Dictionary,
) {
  return t.explanation[explanation.key]
    .replace("{timeframe}", formatTimeframe(explanation, t))
    .replace("{phase}", formatPhase(explanation, t));
}

function formatTimeframe(explanation: ScannerExplanation, t: Dictionary) {
  return explanation.params?.timeframe
    ? t.timeframe[explanation.params.timeframe]
    : t.common.notAvailable;
}

function formatPhase(explanation: ScannerExplanation, t: Dictionary) {
  return explanation.params?.phase
    ? t.phase[explanation.params.phase]
    : t.common.notAvailable;
}
