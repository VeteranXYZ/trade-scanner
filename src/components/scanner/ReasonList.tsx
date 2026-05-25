type ReasonListProps = {
  title: string;
  items: string[];
};

export function ReasonList({ title, items }: ReasonListProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-[#0b0f14] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
