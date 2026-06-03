import type { ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "accent"
  | "positive"
  | "negative"
  | "warning"
  | "danger"
  | "info"
  | "eligible"
  | "watch"
  | "risk"
  | "overheated"
  | "complete"
  | "partial"
  | "missing";

export type SectionTone =
  | "neutral"
  | "selected"
  | "observation"
  | "summary"
  | "takeaway"
  | "rows"
  | "snapshot"
  | "screener";

type MetadataItem = {
  label: string;
  value: ReactNode;
  tone?: StatusTone;
};

const toneClass: Record<StatusTone, string> = {
  neutral:
    "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]",
  accent: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  positive:
    "border-[var(--positive-border)] bg-[var(--positive-bg)] text-[var(--positive)]",
  negative:
    "border-[var(--negative-border)] bg-[var(--negative-bg)] text-[var(--negative)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
  info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
  eligible:
    "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]",
  watch: "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]",
  risk: "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]",
  overheated:
    "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]",
  complete:
    "border-[var(--complete-border)] bg-[var(--complete-bg)] text-[var(--complete)]",
  partial:
    "border-[var(--partial-border)] bg-[var(--partial-bg)] text-[var(--partial)]",
  missing:
    "border-[var(--missing-border)] bg-[var(--missing-bg)] text-[var(--missing)]",
};

const sectionToneClass: Record<SectionTone, string> = {
  neutral: "border-l-[var(--section-snapshot)]",
  selected:
    "border-l-[var(--section-selected)] bg-[linear-gradient(90deg,var(--section-selected-bg),var(--panel)_28%)]",
  observation:
    "border-l-[var(--section-observation)] bg-[linear-gradient(90deg,var(--section-observation-bg),var(--panel)_28%)]",
  summary:
    "border-l-[var(--section-summary)] bg-[linear-gradient(90deg,var(--section-summary-bg),var(--panel)_28%)]",
  takeaway:
    "border-l-[var(--section-takeaway)] bg-[linear-gradient(90deg,var(--section-takeaway-bg),var(--panel)_28%)]",
  rows:
    "border-l-[var(--section-rows)] bg-[linear-gradient(90deg,var(--section-rows-bg),var(--panel)_28%)]",
  snapshot:
    "border-l-[var(--section-snapshot)] bg-[linear-gradient(90deg,var(--section-snapshot-bg),var(--panel)_28%)]",
  screener:
    "border-l-[var(--accent)] bg-[linear-gradient(90deg,var(--accent-soft),var(--panel)_28%)]",
};

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col bg-[var(--workspace-background)] px-2 py-2 sm:px-3 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metadata,
  tone = "screener",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metadata?: MetadataItem[];
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <header
      className={`mb-2 border border-l-4 border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-3 shadow-[var(--shadow-panel)] ${sectionToneClass[tone]} ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-normal text-[var(--accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-base font-semibold leading-6 text-[var(--foreground)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-4xl text-[11px] leading-5 text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="max-w-full shrink-0">{actions}</div> : null}
      </div>
      {metadata && metadata.length > 0 ? (
        <MetadataStrip items={metadata} className="mt-3" />
      ) : null}
    </header>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  tone = "neutral",
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: SectionTone;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = title || description || actions;

  return (
    <section
      className={`border border-l-4 border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-panel)] ${sectionToneClass[tone]} ${className}`}
    >
      {hasHeader ? (
        <SectionHeader title={title} description={description} actions={actions} />
      ) : null}
      <div className={bodyClassName || (hasHeader ? "px-3 py-2" : "p-3")}>
        {children}
      </div>
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2 ${className}`}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-sm font-semibold leading-5 text-[var(--foreground)]">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="mt-1 max-w-4xl text-[11px] leading-5 text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="max-w-full">{actions}</div> : null}
    </div>
  );
}

export function PageToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function ControlGroup({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0 ${className}`}>
      {title ? (
        <h3 className="text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function MetadataStrip({
  items,
  className = "",
}: {
  items: MetadataItem[];
  className?: string;
}) {
  return (
    <dl
      className={`grid gap-2 border border-[var(--border-medium)] bg-[var(--panel-tinted)] px-2 py-2 text-[11px] sm:grid-cols-2 xl:grid-cols-4 ${className}`}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
            {item.label}
          </dt>
          <dd
            className={`mt-0.5 inline-flex max-w-full items-center border px-1.5 py-0.5 font-semibold ${
              toneClass[item.tone ?? "neutral"]
            }`}
          >
            <span className="truncate">{item.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricCard({
  label,
  value,
  tone = "neutral",
  detail,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatusTone;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 border border-l-4 border-[var(--border)] bg-[var(--panel-muted)] px-2.5 py-2 ${
        tone === "neutral" ? "border-l-[var(--neutral-border)]" : toneClass[tone]
      } ${className}`}
    >
      <div className="truncate text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </div>
      {detail ? (
        <div
          className={`mt-1 inline-flex border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass[tone]}`}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center whitespace-nowrap border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ResearchNotice({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <section
      className={`border px-3 py-2 text-[11px] leading-5 ${toneClass[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  message,
  className = "",
}: {
  title: ReactNode;
  message: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-[var(--border)] bg-[var(--panel)] px-3 py-8 text-center ${className}`}
    >
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-[12px] leading-5 text-[var(--muted)]">
        {message}
      </p>
    </section>
  );
}

export function getStatusToneClass(tone: StatusTone) {
  return toneClass[tone];
}
