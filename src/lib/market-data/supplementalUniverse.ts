import {
  buildListingId,
  getMarketDedupKey,
  type MarketListing,
} from "./symbolIdentity";

export const BINANCE_PRIMARY_PRIORITY = 1;
export const COINBASE_SUPPLEMENTAL_PRIORITY = 2;

export type ResearchUniverseRow = MarketListing & {
  listingId: string;
  dedupKey: string;
  selectionRole: "primary" | "supplemental";
};

export type SupplementalUniverseInput = {
  primaryListings: MarketListing[];
  supplementalListings?: MarketListing[];
};

export function selectSupplementalUniverse({
  primaryListings,
  supplementalListings = [],
}: SupplementalUniverseInput): ResearchUniverseRow[] {
  const rows: ResearchUniverseRow[] = [];
  const selectedDedupKeys = new Set<string>();
  const candidates = [...primaryListings, ...supplementalListings].sort(
    compareMarketListingPriority,
  );

  for (const listing of candidates) {
    const dedupKey = getMarketDedupKey(listing);

    if (selectedDedupKeys.has(dedupKey)) {
      continue;
    }

    selectedDedupKeys.add(dedupKey);
    rows.push({
      ...listing,
      listingId: buildListingId(listing),
      dedupKey,
      selectionRole:
        listing.sourcePriority === BINANCE_PRIMARY_PRIORITY ? "primary" : "supplemental",
    });
  }

  return rows;
}

export function compareMarketListingPriority(
  left: MarketListing,
  right: MarketListing,
) {
  const priorityDelta = left.sourcePriority - right.sourcePriority;

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftQuoteVolume = left.quoteVolume ?? 0;
  const rightQuoteVolume = right.quoteVolume ?? 0;
  const quoteVolumeDelta = rightQuoteVolume - leftQuoteVolume;

  if (quoteVolumeDelta !== 0) {
    return quoteVolumeDelta;
  }

  return left.rawSymbol.localeCompare(right.rawSymbol);
}
