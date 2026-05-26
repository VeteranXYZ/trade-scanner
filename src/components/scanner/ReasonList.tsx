import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatScannerExplanation } from "@/lib/i18n/formatScannerExplanation";
import type { ScannerExplanation } from "@/lib/shared/scannerTypes";

type ReasonListProps = {
  title: string;
  items: ScannerExplanation[];
};

export function ReasonList({ title, items }: ReasonListProps) {
  const { dictionary: t } = useLanguage();

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
        {items.map((item) => (
          <li
            key={`${item.key}-${JSON.stringify(item.params ?? {})}`}
            className="rounded-md bg-[#0b0f14] px-3 py-2"
          >
            {formatScannerExplanation(item, t)}
          </li>
        ))}
      </ul>
    </div>
  );
}
