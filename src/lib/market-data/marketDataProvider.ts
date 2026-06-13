import type {
  Candle,
  DataProvider,
  Exchange,
  Timeframe,
} from "@/lib/shared/timeframes";
import type { MarketListing } from "./symbolIdentity";

export type ListMarketsRequest = {
  exchange?: Exchange;
  market?: string;
  assetClass?: MarketListing["assetClass"];
};

export type FetchCandlesRequest = {
  listing: MarketListing;
  timeframe: Timeframe;
  limit?: number;
  startTime?: number;
  endTime?: number;
};

export type CandleProviderResult = {
  provider: DataProvider;
  exchange: Exchange;
  market: string;
  rawSymbol: string;
  providerSymbol: string;
  timeframe: Timeframe;
  candles: Candle[];
};

export interface MarketDataProvider {
  readonly provider: DataProvider;
  listMarkets(request?: ListMarketsRequest): Promise<MarketListing[]>;
  fetchCandles(request: FetchCandlesRequest): Promise<CandleProviderResult>;
}
