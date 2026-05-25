"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { Candle } from "@/lib/exchanges/types";
import { calculateBollingerSeries, calculateSmaSeries } from "@/lib/indicators";

type CandleChartProps = {
  candles: Candle[];
};

export function CandleChart({ candles }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => buildChartData(candles), [candles]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || chartData.candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f14" },
        textColor: "#8b949e",
      },
      grid: {
        vertLines: { color: "#18222d" },
        horzLines: { color: "#18222d" },
      },
      rightPriceScale: {
        borderColor: "#26313d",
      },
      timeScale: {
        borderColor: "#26313d",
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: "#8b949e" },
        horzLine: { color: "#8b949e" },
      },
    });

    addSeries(chart, chartData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [chartData]);

  if (candles.length === 0) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center rounded-md border border-[var(--border)] bg-[#0b0f14] text-sm text-[var(--muted)]">
        No candle data available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full rounded-md border border-[var(--border)] bg-[#0b0f14]"
    />
  );
}

function addSeries(chart: IChartApi, data: ChartData) {
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: "#3fb950",
    downColor: "#ff7b72",
    borderUpColor: "#3fb950",
    borderDownColor: "#ff7b72",
    wickUpColor: "#3fb950",
    wickDownColor: "#ff7b72",
  });
  candles.setData(data.candles);

  addLine(chart, data.ma20, "#58a6ff", "MA20", 2);
  addLine(chart, data.ma50, "#d2a8ff", "MA50", 2);
  addLine(chart, data.ma200, "#f2cc60", "MA200", 2);
  addLine(chart, data.bbUpper, "#8b949e", "BB Upper", 1);
  addLine(chart, data.bbMiddle, "#6e7681", "BB Middle", 1);
  addLine(chart, data.bbLower, "#8b949e", "BB Lower", 1);
}

function addLine(
  chart: IChartApi,
  data: LineData<UTCTimestamp>[],
  color: string,
  title: string,
  lineWidth: 1 | 2,
) {
  if (data.length === 0) {
    return;
  }

  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth,
    title,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  series.setData(data);
}

type ChartData = {
  candles: CandlestickData<UTCTimestamp>[];
  ma20: LineData<UTCTimestamp>[];
  ma50: LineData<UTCTimestamp>[];
  ma200: LineData<UTCTimestamp>[];
  bbUpper: LineData<UTCTimestamp>[];
  bbMiddle: LineData<UTCTimestamp>[];
  bbLower: LineData<UTCTimestamp>[];
};

function buildChartData(candles: Candle[]): ChartData {
  const closes = candles.map((candle) => candle.close);
  const times = candles.map((candle) => toChartTime(candle.openTime));
  const bollinger = calculateBollingerSeries(closes, 20, 2);

  return {
    candles: candles.map((candle) => ({
      time: toChartTime(candle.openTime),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })),
    ma20: buildSmaLine(times, closes, 20),
    ma50: buildSmaLine(times, closes, 50),
    ma200: buildSmaLine(times, closes, 200),
    bbUpper: buildBollingerLine(times, bollinger, "upper"),
    bbMiddle: buildBollingerLine(times, bollinger, "middle"),
    bbLower: buildBollingerLine(times, bollinger, "lower"),
  };
}

function buildSmaLine(
  times: UTCTimestamp[],
  values: number[],
  period: number,
): LineData<UTCTimestamp>[] {
  const series = calculateSmaSeries(values, period);
  const offset = period - 1;

  return series.map((value, index) => ({
    time: times[index + offset],
    value,
  }));
}

function buildBollingerLine(
  times: UTCTimestamp[],
  bands: ReturnType<typeof calculateBollingerSeries>,
  key: "upper" | "middle" | "lower",
): LineData<UTCTimestamp>[] {
  const offset = 19;

  return bands.map((band, index) => ({
    time: times[index + offset],
    value: band[key],
  }));
}

function toChartTime(openTime: number) {
  return Math.floor(openTime / 1000) as UTCTimestamp;
}
