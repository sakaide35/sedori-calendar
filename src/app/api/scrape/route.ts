import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface ScrapedProduct {
  name: string;
  category: string;
  price: number;
  market_price?: number;
  premium_rate?: number;
  event_date: string;
  event_end_date?: string;
  event_type: "release" | "lottery" | "restock";
  source: string;
  note?: string;
}

async function scrapeTenbaiQuest(): Promise<ScrapedProduct[]> {
  try {
    const res = await fetch("https://tenbaiquest.com/", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    const html = await res.text();
    // TODO: HTMLパース実装（cheerio等を追加後）
    // 現時点ではフレームワークのみ用意
    console.log(`[scrape] tenbaiquest: fetched ${html.length} bytes`);
    return [];
  } catch (e) {
    console.error("[scrape] tenbaiquest error:", e);
    return [];
  }
}

async function scrapeNyukaNow(): Promise<ScrapedProduct[]> {
  try {
    const res = await fetch("https://nyuka-now.com/", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    const html = await res.text();
    console.log(`[scrape] nyuka-now: fetched ${html.length} bytes`);
    return [];
  } catch (e) {
    console.error("[scrape] nyuka-now error:", e);
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: ScrapedProduct[] = [];

  // 各ソースからスクレイピング
  const [tenbaiQuest, nyukaNow] = await Promise.all([
    scrapeTenbaiQuest(),
    scrapeNyukaNow(),
  ]);

  results.push(...tenbaiQuest, ...nyukaNow);

  // DBに挿入（重複チェック: 同名+同日のものはスキップ）
  let inserted = 0;
  for (const product of results) {
    const { data: existing } = await getSupabaseAdmin()
      .from("products")
      .select("id")
      .eq("name", product.name)
      .eq("event_date", product.event_date)
      .maybeSingle();

    if (!existing) {
      const { error } = await getSupabaseAdmin()
        .from("products")
        .insert(product);
      if (!error) inserted++;
    }
  }

  return NextResponse.json({
    message: `Scraped ${results.length} products, inserted ${inserted} new`,
    timestamp: new Date().toISOString(),
  });
}
