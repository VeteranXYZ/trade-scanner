import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScanResult } from "@/lib/scanner/types";

type StrategyReadPanelProps = {
  result: ScanResult;
};

export function StrategyReadPanel({ result }: StrategyReadPanelProps) {
  const { dictionary: t } = useLanguage();
  const missingIndicators = result.dataQuality.missingIndicators;

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">{t.strategy.title}</h2>

      <div className="space-y-3">
        <ReadBlock
          label={t.strategy.phaseRead}
          value={t.phase[result.phase]}
          text={t.strategy.phaseRule[result.phase]}
        />
        <ReadBlock
          label={t.strategy.signalRead}
          value={t.signal[result.signal.state]}
          text={t.strategy.signalRule[result.signal.state]}
        />
      </div>

      <div className="mt-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3">
        <div className="text-sm font-semibold">{t.strategy.scoringModel}</div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {t.strategy.scoreWeights}
        </p>
        <div className="mt-3 space-y-3">
          <ScoreRow
            label={t.scanner.columns.opportunity}
            value={result.opportunityScore}
            help={t.strategy.opportunityHelp}
          />
          <ScoreRow
            label={t.scanner.columns.confirmation}
            value={result.confirmationScore}
            help={t.strategy.confirmationHelp}
          />
          <ScoreRow
            label={t.common.risk}
            value={result.riskScore}
            help={t.strategy.riskHelp}
            risk
          />
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">{t.strategy.dataQuality}</span>
          <span className="tabular-nums text-[var(--muted)]">
            {result.dataQuality.candleCount} {t.strategy.candles}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {result.dataQuality.sufficientHistory
            ? t.strategy.sufficientHistory
            : t.strategy.limitedHistory}
        </p>
        {missingIndicators.length > 0 && (
          <p className="mt-2 text-sm text-[var(--warning)]">
            {t.strategy.missingIndicators}: {missingIndicators.join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}

function ReadBlock({
  label,
  value,
  text,
}: {
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
          {label}
        </span>
        <span className="rounded-md bg-[#101923] px-2 py-1 text-xs font-semibold">
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  help,
  risk = false,
}: {
  label: string;
  value: number;
  help: string;
  risk?: boolean;
}) {
  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--muted)]">{value.toFixed(0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#111820]">
        <div
          className={`h-full rounded-full ${
            risk ? "bg-[var(--warning)]" : "bg-[var(--accent)]"
          }`}
          style={{ width }}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{help}</p>
    </div>
  );
}
