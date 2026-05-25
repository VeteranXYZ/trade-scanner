type PhaseBadgeProps = {
  phase: string;
};

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  return (
    <span className="inline-flex rounded-md bg-[#16251b] px-2 py-1 text-xs font-semibold text-[var(--accent)]">
      {phase}
    </span>
  );
}
