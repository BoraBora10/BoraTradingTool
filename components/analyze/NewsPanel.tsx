import type { NewsItem } from "@/lib/providers/types";
import { ExternalLink } from "lucide-react";

interface Props {
  news: NewsItem[];
}

function sentimentLabel(s: number) {
  if (s > 0.3) return { label: "Positive", cls: "text-gain" };
  if (s < -0.3) return { label: "Negative", cls: "text-loss" };
  return { label: "Neutral", cls: "text-amber" };
}

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NewsPanel({ news }: Props) {
  return (
    <div className="bg-panel border border-panel rounded p-4">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent News</h2>
      <div className="space-y-3">
        {news.map((item) => {
          const sent = sentimentLabel(item.sentiment);
          return (
            <div key={item.id} className="border-b border-panel pb-3 last:border-0 last:pb-0">
              <div className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${sent.cls.replace("text-", "bg-")}`} />
                <div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold hover:text-terminal transition-colors leading-snug flex items-start gap-1"
                  >
                    <span>{item.headline}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-50" />
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{timeAgo(item.publishedAt)}</span>
                    <span>·</span>
                    <span className={sent.cls}>{sent.label}</span>
                  </div>
                  {item.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
