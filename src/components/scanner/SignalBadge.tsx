import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScannerSignal } from "@/lib/shared/scannerTypes";

type SignalBadgeProps = {
  signal: ScannerSignal;
};

export const signalToneClass: Record<ScannerSignal["state"], string> = {
  WATCHLIST: "border-[#8f7a31]/70 bg-[#1b180d] text-[var(--warning)]",
  CONFIRMED: "border-[#2f7d46]/70 bg-[#101b15] text-[var(--accent)]",
  TREND_CONTINUATION: "border-[#2d5b89]/70 bg-[#0e1722] text-[#86b7ef]",
  HIGH_RISK: "border-[#8f3a3a]/70 bg-[#211111] text-[var(--danger)]",
  WEAK: "border-[#6d4a2f]/70 bg-[#1c140d] text-[#d8a16b]",
  NEUTRAL: "border-[var(--border)] bg-[#0b0f14] text-[var(--muted)]",
};

export function SignalBadge({ signal }: SignalBadgeProps) {
  const { dictionary: t } = useLanguage();

  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[11px] font-semibold leading-none ${signalToneClass[signal.state]}`}
      title={t.signalSummary[signal.state]}
    >
      {t.signal[signal.state]}
    </span>
  );
}
