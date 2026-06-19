"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/providers/types";

type Timeframe = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y";

interface Props {
  ticker: string;
  initialCandles: Candle[];
  quotePrice: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
}

const TIMEFRAME_CONFIG: Record<Timeframe, { resolution: string; days: number }> = {
  "1D": { resolution: "5", days: 1 },
  "5D": { resolution: "15", days: 5 },
  "1M": { resolution: "60", days: 30 },
  "6M": { resolution: "D", days: 180 },
  "YTD": { resolution: "D", days: new Date().getMonth() * 30 + new Date().getDate() },
  "1Y": { resolution: "D", days: 365 },
  "5Y": { resolution: "W", days: 1825 },
};

function computeSMA(candles: Candle[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const avg = candles.slice(i - period + 1, i + 1).reduce((sum, c) => sum + c.close, 0) / period;
    result.push({ time: candles[i].time, value: +avg.toFixed(2) });
  }
  return result;
}

function isSimulated(candles: Candle[], quotePrice: number): boolean {
  if (candles.length === 0) return false;
  const lastClose = candles[candles.length - 1].close;
  return Math.abs(lastClose - quotePrice) / quotePrice > 0.3;
}

export function CandlestickChart({ ticker, initialCandles, quotePrice }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [candles, setCandles] = useState<Candle[]>(initialCandles);
  const [loading, setLoading] = useState(false);
  const simulated = isSimulated(candles, quotePrice);

  async function loadCandles(tf: Timeframe) {
    setLoading(true);
    try {
      const { days, resolution } = TIMEFRAME_CONFIG[tf];
      const to = Math.floor(Date.now() / 1000);
      const from = to - days * 86400;
      const res = await fetch(`/api/candles?ticker=${ticker}&resolution=${resolution}&from=${from}&to=${to}`);
      const data = await res.json();
      setCandles(data.candles ?? initialCandles);
    } catch {
      setCandles(initialCandles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then((lc) => {
      if (!chartRef.current) return;

      const chart = lc.createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 420,
        layout: { background: { color: "#111111" }, textColor: "#a0a0a0" },
        grid: { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#2a2a2a" },
        timeScale: { borderColor: "#2a2a2a", timeVisible: true },
      });

      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#00cc66",
        downColor: "#cc3333",
        borderUpColor: "#00cc66",
        borderDownColor: "#cc3333",
        wickUpColor: "#00cc66",
        wickDownColor: "#cc3333",
        // Hide the default last-candle price line + axis label; we draw our own
        // at the live quote so daily timeframes reflect the latest (extended-
        // hours) price instead of the regular-session close. Keep the default
        // for simulated data, where the real quote wouldn't match the fake candles.
        priceLineVisible: simulated,
        lastValueVisible: simulated,
      });

      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        color: "#26a69a",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      const sma20Series = chart.addSeries(lc.LineSeries, { color: "#3399ff", lineWidth: 1, priceLineVisible: false });
      const sma50Series = chart.addSeries(lc.LineSeries, { color: "#ffcc00", lineWidth: 1, priceLineVisible: false });
      const sma200Series = chart.addSeries(lc.LineSeries, { color: "#ff6600", lineWidth: 1, priceLineVisible: false });

      type LCTime = import("lightweight-charts").Time;
      const candleData = candles.map((c) => ({ time: c.time as LCTime, open: c.open, high: c.high, low: c.low, close: c.close }));
      const volData = candles.map((c) => ({ time: c.time as LCTime, value: c.volume, color: c.close >= c.open ? "#00cc6640" : "#cc333340" }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volData);

      // Current-price line at the live (extended-hours) quote, consistent across
      // all timeframes and matching the header.
      if (!simulated && quotePrice > 0) {
        candleSeries.createPriceLine({
          price: quotePrice,
          color: "#e0e0e0",
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: "",
        });
      }
      sma20Series.setData(computeSMA(candles, 20).map((d) => ({ ...d, time: d.time as LCTime })));
      sma50Series.setData(computeSMA(candles, 50).map((d) => ({ ...d, time: d.time as LCTime })));
      sma200Series.setData(computeSMA(candles, 200).map((d) => ({ ...d, time: d.time as LCTime })));

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
      });
      ro.observe(chartRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
      };
    });

    return () => cleanup?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  return (
    <div className="bg-panel border border-panel rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Price Chart</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-3 h-0.5 bg-[#3399ff] inline-block" /> SMA20
            <span className="w-3 h-0.5 bg-[#ffcc00] inline-block" /> SMA50
            <span className="w-3 h-0.5 bg-[#ff6600] inline-block" /> SMA200
          </div>
          <div className="flex gap-1">
            {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => { setTimeframe(tf); loadCandles(tf); }}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  timeframe === tf ? "bg-terminal text-black font-bold" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      {simulated && (
        <div className="mb-2 px-2 py-1.5 bg-amber/10 border border-amber/30 rounded text-xs text-amber flex items-center gap-2">
          <span>⚠</span>
          <span>Chart shows simulated price history — Finnhub candle data unavailable for this symbol on the free tier. Quote prices above are real.</span>
        </div>
      )}
      <div className="relative">
        <div ref={chartRef} className="w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/80">
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}
