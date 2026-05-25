export function IndicatorLegend() {
  const items = [
    ["#58a6ff", "MA20"],
    ["#d2a8ff", "MA50"],
    ["#f2cc60", "MA200"],
    ["#8b949e", "Bollinger Bands"],
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <span
            className="h-2 w-5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
