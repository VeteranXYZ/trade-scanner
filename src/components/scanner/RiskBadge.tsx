type RiskBadgeProps = {
  label: string;
};

export function RiskBadge({ label }: RiskBadgeProps) {
  return (
    <span className="inline-flex rounded-md bg-[#2b2111] px-2 py-1 text-xs font-semibold leading-5 text-[var(--warning)]">
      {label}
    </span>
  );
}
