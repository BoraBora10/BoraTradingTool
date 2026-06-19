"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface Props {
  ticker: string;
  price: number;
  signal: "buy" | "hold" | "sell";
}

export function ClaudePromptBlock({ ticker, price, signal }: Props) {
  const [copied, setCopied] = useState(false);

  const prompt = `Read context/stock-${ticker}.json and give me a deep analysis of ${ticker} (currently at $${price.toFixed(2)}, research signal: ${signal.toUpperCase()}).

Cover:
1. Summary: what is the market telling us right now?
2. Bull case: what would need to be true for this to outperform?
3. Bear case: what are the main risks?
4. Key catalysts to watch in the next 30-90 days
5. Entry/exit levels based on the technicals
6. Your recommendation: would you add, hold, or trim here, and why?

Context file path: context/stock-${ticker}.json`;

  function copy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-panel border border-terminal/20 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-terminal" />
          <h2 className="text-xs font-bold text-terminal uppercase tracking-wider">Deep Analysis — Claude Code Prompt</h2>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal/10 border border-terminal/30 rounded text-xs text-terminal hover:bg-terminal/20 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy prompt"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Paste this prompt into your Claude Code terminal session. The app has written a context file with all the data Claude needs to analyze {ticker}.
      </p>

      <pre className="bg-accent rounded p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap border border-border">
        {prompt}
      </pre>

      <div className="mt-3 text-xs text-muted-foreground">
        <span className="text-terminal">Tip:</span> Make sure you have run <code className="bg-accent px-1 rounded">npm run dev</code> and viewed the {ticker} page at least once so the context file is generated. Claude Code reads <code className="bg-accent px-1 rounded">context/stock-{ticker}.json</code> directly.
      </div>
    </div>
  );
}
