import type { Metadata } from "next";
import { WatchlistPageClient } from "@/components/watchlist/WatchlistPageClient";

type WatchlistPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Monitor selected symbols against the latest research snapshot.",
};

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  return <WatchlistPageClient initialQueryState={await searchParams} />;
}
