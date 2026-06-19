"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, BarChart2, Newspaper, List, Settings, TrendingUp, Briefcase, Bot } from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "OVERVIEW", icon: BarChart2 },
  { href: "/watchlist", label: "WATCHLIST", icon: List },
  { href: "/news", label: "NEWS", icon: Newspaper },
  { href: "/portfolio", label: "PORTFOLIO", icon: Briefcase },
  { href: "/trades", label: "TRADES", icon: Bot },
  { href: "/settings", label: "SETTINGS", icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const ticker = query.trim().toUpperCase();
    if (ticker) {
      router.push(`/analyze/${ticker}`);
      setQuery("");
    }
  }

  return (
    <header className="border-b border-panel bg-panel px-4 py-2 flex items-center gap-4">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <TrendingUp className="w-5 h-5 text-terminal" />
        <span className="text-terminal font-bold text-base tracking-wider">MARKETPULSE</span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              pathname.startsWith(href)
                ? "bg-accent text-terminal border border-terminal/30"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </Link>
        ))}
      </nav>

      <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ticker symbol... (e.g. AAPL)"
            className="pl-7 pr-3 py-1.5 bg-accent border border-border rounded text-xs w-52 focus:outline-none focus:border-terminal/50 focus:ring-0 placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90 transition-colors"
        >
          ANALYZE
        </button>
      </form>
    </header>
  );
}
