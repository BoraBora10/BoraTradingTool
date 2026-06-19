import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const active = !!process.env.FINNHUB_API_KEY?.trim();
  return NextResponse.json({ active });
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    const envPath = path.join(process.cwd(), ".env.local");
    let content = "";
    try {
      content = await fs.readFile(envPath, "utf-8");
    } catch {
      // file doesn't exist yet
    }

    // Replace or append FINNHUB_API_KEY
    if (content.includes("FINNHUB_API_KEY=")) {
      content = content.replace(/FINNHUB_API_KEY=.*/g, `FINNHUB_API_KEY=${key}`);
    } else {
      content = content.trimEnd() + (content ? "\n" : "") + `FINNHUB_API_KEY=${key}\n`;
    }

    await fs.writeFile(envPath, content);

    // Apply immediately without restart (persists only for this process lifetime;
    // .env.local ensures it survives restarts)
    process.env.FINNHUB_API_KEY = key;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
