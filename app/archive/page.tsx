import type { Metadata } from "next";
import { ArchivePageClient } from "@/components/archive/ArchivePageClient";

type ArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Research Archive",
  description:
    "Browse stored runs and snapshots to review how setups evolved.",
};

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  return <ArchivePageClient initialQueryState={await searchParams} />;
}
