import type { Candle } from "@/lib/providers/types";

export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  support: number | null;
  resistance: number | null;
  trend: "bullish" | "bearish" | "neutral";
}

function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function rsi(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map((c) => Math.max(c, 0));
  const losses = changes.map((c) => Math.max(-c, 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

export function computeTechnicals(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const rsiVal = rsi(closes);

  // MACD (12, 26, 9)
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  let macdLine: number | null = null;
  let macdSignal: number | null = null;
  let macdHist: number | null = null;
  if (ema12.length > 0 && ema26.length > 0) {
    const macdSeries = ema26.map((v, i) => {
      const e12idx = ema12.length - ema26.length + i;
      return e12idx >= 0 ? ema12[e12idx] - v : null;
    }).filter((v): v is number => v !== null);

    if (macdSeries.length >= 9) {
      const signalSeries = ema(macdSeries, 9);
      macdLine = +macdSeries[macdSeries.length - 1].toFixed(3);
      macdSignal = +signalSeries[signalSeries.length - 1].toFixed(3);
      macdHist = +(macdLine - macdSignal).toFixed(3);
    }
  }

  // Bollinger Bands (20, 2)
  let bbUpper: number | null = null;
  let bbMiddle: number | null = null;
  let bbLower: number | null = null;
  if (closes.length >= 20) {
    const slice = closes.slice(-20);
    const mean = slice.reduce((a, b) => a + b) / 20;
    const std = Math.sqrt(slice.map((v) => (v - mean) ** 2).reduce((a, b) => a + b) / 20);
    bbMiddle = +mean.toFixed(2);
    bbUpper = +(mean + 2 * std).toFixed(2);
    bbLower = +(mean - 2 * std).toFixed(2);
  }

  // Support & Resistance (simple: recent swing low/high over last 50 candles)
  const window = Math.min(50, candles.length);
  const recentHighs = highs.slice(-window);
  const recentLows = lows.slice(-window);
  const resistance = recentHighs.length ? +Math.max(...recentHighs).toFixed(2) : null;
  const support = recentLows.length ? +Math.min(...recentLows).toFixed(2) : null;

  // Trend classification
  const price = closes[closes.length - 1];
  let trend: "bullish" | "bearish" | "neutral" = "neutral";
  if (s20 && s50 && s200) {
    if (price > s20 && s20 > s50 && s50 > s200) trend = "bullish";
    else if (price < s20 && s20 < s50 && s50 < s200) trend = "bearish";
  }

  return {
    sma20: s20 ? +s20.toFixed(2) : null,
    sma50: s50 ? +s50.toFixed(2) : null,
    sma200: s200 ? +s200.toFixed(2) : null,
    rsi: rsiVal,
    macdLine,
    macdSignal,
    macdHist,
    bbUpper,
    bbMiddle,
    bbLower,
    support,
    resistance,
    trend,
  };
}

export interface Signal {
  label: string;
  type: "bull" | "bear";
  reason: string;
}

export function computeSignals(
  price: number,
  tech: TechnicalIndicators,
  fundamentals: { pe: number | null; revenueGrowth: number | null; netMargin: number | null },
  analystBuy: number,
  analystSell: number
): { bullSignals: Signal[]; bearSignals: Signal[]; overallSignal: "buy" | "hold" | "sell" } {
  const bullSignals: Signal[] = [];
  const bearSignals: Signal[] = [];

  if (tech.rsi !== null) {
    if (tech.rsi < 30) bullSignals.push({ label: "RSI Oversold", type: "bull", reason: `RSI at ${tech.rsi} — historically a mean-reversion opportunity` });
    if (tech.rsi > 70) bearSignals.push({ label: "RSI Overbought", type: "bear", reason: `RSI at ${tech.rsi} — elevated, watch for pullback` });
  }

  if (tech.sma20 && tech.sma50) {
    if (tech.sma20 > tech.sma50) bullSignals.push({ label: "Golden Cross (20/50)", type: "bull", reason: "SMA20 above SMA50 — short-term bullish momentum" });
    else bearSignals.push({ label: "Death Cross (20/50)", type: "bear", reason: "SMA20 below SMA50 — short-term bearish momentum" });
  }

  if (tech.sma200) {
    if (price > tech.sma200) bullSignals.push({ label: "Above 200 SMA", type: "bull", reason: "Price trading above long-term trend line" });
    else bearSignals.push({ label: "Below 200 SMA", type: "bear", reason: "Price trading below long-term trend line" });
  }

  if (tech.macdHist !== null) {
    if (tech.macdHist > 0) bullSignals.push({ label: "MACD Positive", type: "bull", reason: "MACD histogram positive — bullish momentum" });
    else bearSignals.push({ label: "MACD Negative", type: "bear", reason: "MACD histogram negative — bearish momentum" });
  }

  if (tech.bbLower && price < tech.bbLower) bullSignals.push({ label: "BB Lower Band Touch", type: "bull", reason: "Price near lower Bollinger Band — potential bounce" });
  if (tech.bbUpper && price > tech.bbUpper) bearSignals.push({ label: "BB Upper Band Touch", type: "bear", reason: "Price near upper Bollinger Band — potential resistance" });

  if (tech.trend === "bullish") bullSignals.push({ label: "Uptrend", type: "bull", reason: "Price > SMA20 > SMA50 > SMA200 — strong uptrend alignment" });
  if (tech.trend === "bearish") bearSignals.push({ label: "Downtrend", type: "bear", reason: "Price < SMA20 < SMA50 < SMA200 — strong downtrend alignment" });

  if (fundamentals.pe !== null) {
    if (fundamentals.pe < 20) bullSignals.push({ label: "Low P/E", type: "bull", reason: `P/E of ${fundamentals.pe.toFixed(1)}x is attractive relative to market` });
    if (fundamentals.pe > 50) bearSignals.push({ label: "High P/E", type: "bear", reason: `P/E of ${fundamentals.pe.toFixed(1)}x prices in significant growth — execution risk` });
  }

  if (fundamentals.revenueGrowth !== null && fundamentals.revenueGrowth > 0.2)
    bullSignals.push({ label: "Strong Revenue Growth", type: "bull", reason: `${(fundamentals.revenueGrowth * 100).toFixed(0)}% revenue growth — above-market expansion` });

  if (analystBuy > analystSell * 2) bullSignals.push({ label: "Analyst Consensus Buy", type: "bull", reason: `${analystBuy} Buy vs ${analystSell} Sell ratings — strong consensus` });
  if (analystSell > analystBuy) bearSignals.push({ label: "Analyst Consensus Sell", type: "bear", reason: `${analystSell} Sell vs ${analystBuy} Buy ratings — cautious consensus` });

  const score = bullSignals.length - bearSignals.length;
  const overallSignal: "buy" | "hold" | "sell" = score >= 2 ? "buy" : score <= -2 ? "sell" : "hold";

  return { bullSignals, bearSignals, overallSignal };
}
