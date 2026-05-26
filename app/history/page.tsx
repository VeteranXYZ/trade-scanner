const disabledMessage =
  "Persistent scan history is not enabled in this deployment. This private scanner currently uses real-time Remote Binance scans only.";

export default function HistoryPage() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-10">
      <p className="text-sm uppercase tracking-wide text-[var(--muted)]">
        Research
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Scan History</h1>
      <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold">Persistence Disabled</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {disabledMessage}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          持久化扫描历史当前未启用。本私人工具目前只使用 Remote Binance
          实时扫描。
        </p>
      </div>
    </section>
  );
}
