import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { TickerTape } from "@/components/layout/TickerTape";
import { SetupGate } from "@/components/layout/SetupGate";
import { isConfigured } from "@/lib/providers";

export const dynamic = "force-dynamic";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarketPulse — Stock Research Terminal",
  description: "Bloomberg-style stock research and analysis terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = isConfigured();
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {!configured ? (
          <SetupGate />
        ) : (
          <>
            <TopNav />
            <TickerTape />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-panel px-4 py-1 text-xs text-muted-foreground flex items-center justify-between">
              <span>MarketPulse — Not financial advice; analysis is model-generated opinion. Trades execute with <strong>real money</strong> at your own risk.</span>
              <span className="text-gain">LIVE DATA</span>
            </footer>
          </>
        )}
      </body>
    </html>
  );
}
