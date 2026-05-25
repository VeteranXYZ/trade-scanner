type SignalBadgeProps = {
  label: string;
};

export function SignalBadge({ label }: SignalBadgeProps) {
  return (
    <span className="inline-flex rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
      {label}
    </span>
  );
}
