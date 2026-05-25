export type Exchange = "binance";

export type Timeframe = "1h" | "4h" | "1d";

export type Market = {
  exchange: Exchange;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume?: number;
  priceChangePercent?: number;
};

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};
