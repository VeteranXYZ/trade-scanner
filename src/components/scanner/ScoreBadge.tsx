type ScoreBadgeProps = {
  label: string;
  value: number;
  tone?: "default" | "risk";
  compact?: boolean;
};

export function ScoreBadge({
  label,
  value,
  tone = "default",
  compact = false,
}: ScoreBadgeProps) {
  const color = tone === "risk" ? "text-[var(--warning)]" : "text-[var(--accent)]";

  return (
    <span
      className={`inline-flex flex-col rounded-md border border-[var(--border)] px-3 py-2 text-xs ${
        compact ? "min-w-0" : "min-w-24"
      }`}
    >
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`text-base font-semibold ${color}`}>{value}</span>
    </span>
  );
}
