"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/providers/types";

const CATEGORIES = ["ALL", "MARKET", "TECH", "MACRO"] as const;
type Category = (typeof CATEGORIES)[number];

const TECH_KEYWORDS = [
  "ai", "artificial intelligence", "semiconductor", "chip", "chips", "nvidia", "amd", "intel",
  "apple", "microsoft", "google", "alphabet", "meta", "amazon", "tesla", "software", "cloud",
  "data center", "startup", "silicon valley", "tech", "technology", "algorithm", "machine learning",
  "generative", "llm", "openai", "anthropic", "robotics", "electric vehicle", "ev",
];

const MACRO_KEYWORDS = [
  "fed", "federal reserve", "interest rate", "inflation", "cpi", "pce", "gdp", "recession",
  "employment", "unemployment", "jobs report", "tariff", "trade war", "sanctions",
  "treasury", "yield", "dollar", "currency", "monetary policy", "fiscal",
  "fomc", "powell", "central bank", "economic", "economy", "consumer spending",
  "debt ceiling", "deficit", "geopolit",
  // geopolitical / energy
  "iran", "russia", "china", "ukraine", "opec", "oil price", "crude oil", "nuclear",
  "war", "peace deal", "military", "pentagon", "nato", "g7", "g20", "imf", "world bank",
  "supply chain", "export control", "import", "embargo",
];

function classify(item: NewsItem): Category {
  const text = (item.headline + " " + (item.summary ?? "")).toLowerCase();
  let techScore = 0;
  let macroScore = 0;
  for (const kw of TECH_KEYWORDS) if (text.includes(kw)) techScore++;
  for (const kw of MACRO_KEYWORDS) if (text.includes(kw)) macroScore++;
  if (techScore === 0 && macroScore === 0) return "MARKET";
  if (techScore > macroScore) return "TECH";
  if (macroScore > techScore) return "MACRO";
  return "MARKET";
}

function sentimentLabel(s: number) {
  if (s > 0.3) return { label: "Positive", cls: "text-gain bg-green/10 border-gain/30" };
  if (s < -0.3) return { label: "Negative", cls: "text-loss bg-red/10 border-loss/30" };
  return { label: "Neutral", cls: "text-amber bg-amber/10 border-amber/30" };
}

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NewsFeed({ news }: { news: NewsItem[] }) {
  const [active, setActive] = useState<Category>("ALL");

  const classified = news.map((item) => ({ ...item, category: classify(item) }));
  const filtered = active === "ALL" ? classified : classified.filter((n) => n.category === active);

  const counts: Record<Category, number> = {
    ALL: news.length,
    MARKET: classified.filter((n) => n.category === "MARKET").length,
    TECH: classified.filter((n) => n.category === "TECH").length,
    MACRO: classified.filter((n) => n.category === "MACRO").length,
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Market News</h1>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                cat === active
                  ? "bg-terminal text-black font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {cat}
              <span className="ml-1 opacity-60">({counts[cat]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const sent = sentimentLabel(item.sentiment);
          return (
            <article
              key={item.id}
              className="bg-panel border border-panel rounded p-4 hover:border-terminal/20 transition-colors flex flex-col"
            >
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <div className="flex items-start gap-1.5 mb-2">
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 border rounded ${sent.cls}`}>
                      {sent.label}
                    </span>
                    <span className="shrink-0 text-xs px-1.5 py-0.5 border rounded text-muted-foreground border-border bg-accent">
                      {item.category}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:text-terminal transition-colors leading-snug flex items-start gap-1"
                  >
                    <span>{item.headline}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-40" />
                  </a>
                  {item.summary && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{item.summary}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-panel text-xs text-muted-foreground">
                <span>{item.source}</span>
                <span>{timeAgo(item.publishedAt)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
