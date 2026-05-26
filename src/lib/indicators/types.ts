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
    latest: number;
    ma20: number | null;
    ma50: number | null;
    ratio: number | null;
    ratio20: number | null;
    ratio50: number | null;
    quoteVolumeLatest?: number;
    quoteVolumeMA20?: number | null;
    dryUp: boolean;
    expanding: boolean;
    abnormalSpike: boolean;
  };
  macd: {
    line: number | null;
    signal: number | null;
    histogram: number | null;
    histogramRising: boolean;
    bullishCross: boolean;
    bearishCross: boolean;
    aboveZero: boolean;
  };
  priceExtensionFromMA20: number | null;
};
