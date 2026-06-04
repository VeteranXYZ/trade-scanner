import { notFound } from "next/navigation";
import { WatchlistPageClient } from "@/components/watchlist/WatchlistPageClient";
import { buildWatchlistVisualCheckData } from "@/components/watchlist/watchlistPreviewData";

export default function WatchlistVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <WatchlistPageClient visualCheckData={buildWatchlistVisualCheckData()} />
  );
}
