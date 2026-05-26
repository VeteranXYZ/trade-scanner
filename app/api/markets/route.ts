import { NextResponse } from "next/server";
import { cacheKeys } from "@/lib/cache/keys";
import { getCached } from "@/lib/cache/memory";
import { getTopUsdtMarkets } from "@/lib/exchanges/binance";
import type { Market } from "@/lib/exchanges/types";
import { publicErrorMessage } from "@/lib/runtime/publicErrors";

const DEFAULT_MARKET_LIMIT = 100;
const MAX_MARKET_LIMIT = 500;
type TickerMap = Record<
  string,
  { symbol: string; quoteVolume: number; priceChangePercent: number }
>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_MARKET_LIMIT,
    MAX_MARKET_LIMIT,
  );

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    const marketsCacheBefore = getCached<Market[]>(cacheKeys.markets);
    const tickersCacheBefore = getCached<TickerMap>(cacheKeys.tickers);
    const markets = await getTopUsdtMarkets(limit.value);
    const marketsCacheAfter = getCached<Market[]>(cacheKeys.markets);
    const tickersCacheAfter = getCached<TickerMap>(cacheKeys.tickers);

    return NextResponse.json({
      exchange: "binance",
      markets,
      itemCount: markets.length,
      cached: Boolean(marketsCacheBefore && tickersCacheBefore),
      updatedAt:
        tickersCacheAfter?.updatedAt ??
        marketsCacheAfter?.updatedAt ??
        new Date().toISOString(),
    });
  } catch (error) {
    console.error("markets route failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Binance markets.",
        message: publicErrorMessage("Remote market data request failed."),
      },
      { status: 502 },
    );
  }
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (value === null) {
    return { valid: true as const, value: fallback };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return {
      valid: false as const,
      error: `limit must be an integer between 1 and ${max}.`,
    };
  }

  return { valid: true as const, value: parsed };
}
