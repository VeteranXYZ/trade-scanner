export type IndicatorSnapshot = {
  close: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  bollinger: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    width: number | null;
    widthPercentile: number | null;
  };
  rsi14: number | null;
  volume: {
    current: number;
    ma20: number | null;
    ratio: number | null;
  };
  priceExtensionFromMA20: number | null;
};
