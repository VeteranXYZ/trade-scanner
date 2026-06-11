import type { Metadata } from "next";
import { MultiTimeframeScreenerPageClient } from "@/components/screener/MultiTimeframeScreenerPageClient";

type ScreenerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Multi-Timeframe Screener",
  description:
    "Compare joined multi-timeframe research snapshots for validation.",
};

export default async function ScreenerPage({ searchParams }: ScreenerPageProps) {
  return (
    <MultiTimeframeScreenerPageClient initialQueryState={await searchParams} />
  );
}
