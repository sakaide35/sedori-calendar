import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { sendLineBroadcast, formatProductNotification } from "@/lib/line";

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

// カテゴリ推定
function guessCategory(title: string, tags: string[]): string {
  const text = (title + " " + tags.join(" ")).toLowerCase();
  if (/ポケカ|ポケモン|トレカ|mtg|遊戯王|ワンピース/.test(text)) return "card";
  if (/nike|ナイキ|スニーカー|jordan|dunk|snkrs|adidas|yeezy/.test(text)) return "sneaker";
  if (/supreme|シュプリーム|lvc|levi|アパレル|chanel|dior/.test(text)) return "brand";
  if (/ローテック|rolex|ロレックス|時計|seiko|tudor/.test(text)) return "watch";
  if (/leica|ricoh|sony α|nikon|canon|カメラ|レンズ/.test(text)) return "camera";
  if (/rtx|gpu|グラボ|nvidia/.test(text)) return "gpu";
  if (/ウイスキー|山崎|白州|響|マッカラン|酒/.test(text)) return "whisky";
  if (/gibson|fender|楽器|dap|オーディオ/.test(text)) return "instrument";
  if (/be@rbrick|ベアブリック|フィギュア|ソフビ|medicom|ガンプラ|hot toys|lego/.test(text))
    return "hobby";
  return "hobby"; // デフォルト
}

// イベントタイプ推定
function guessEventType(title: string): "release" | "lottery" | "restock" {
  if (/抽選/.test(title)) return "lottery";
  if (/再販|再入荷|restock/.test(title)) return "restock";
  return "release";
}

// タイトルから日付を抽出（例: 【2026/3/1〜抽選】or【2026年3月1日発売】）
function extractDateFromTitle(title: string): string | null {
  // パターン1: 2026/3/1 or 2026/03/01
  const m1 = title.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  }
  // パターン2: 2026年3月1日
  const m2 = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  }
  // パターン3: 3/1（年なし→今年と仮定）
  const m3 = title.match(/(\d{1,2})月(\d{1,2})日/);
  if (m3) {
    const year = new Date().getFullYear();
    return `${year}-${m3[1].padStart(2, "0")}-${m3[2].padStart(2, "0")}`;
  }
  return null;
}

// 本文から定価を抽出
function extractPrice(html: string): number | null {
  const $ = cheerio.load(html);
  const text = $.text();
  // 「定価：396,000円」「定価:19,800円」等
  const m = text.match(/定価[：:]?\s*([0-9,]+)\s*円/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  // 「税込 396,000円」
  const m2 = text.match(/税込[）\)]?\s*([0-9,]+)\s*円/);
  if (m2) return parseInt(m2[1].replace(/,/g, ""), 10);
  return null;
}

// 本文から相場を抽出
function extractMarketPrice(html: string): number | null {
  const $ = cheerio.load(html);
  const text = $.text();
  // 「相場：55万円」「プレ値 100万円」
  const m = text.match(/(?:相場|プレ値|市場価格)[：:]?\s*(?:約)?([0-9,]+)\s*万\s*円/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10) * 10000;
  // 「相場：550,000円」
  const m2 = text.match(/(?:相場|プレ値|市場価格)[：:]?\s*(?:約)?([0-9,]+)\s*円/);
  if (m2) return parseInt(m2[1].replace(/,/g, ""), 10);
  // 「メルカリで100万円前後」
  const m3 = text.match(/(?:メルカリ|ヤフオク|フリマ)(?:で|では|等で)(?:約)?([0-9,]+)\s*万\s*円/);
  if (m3) return parseInt(m3[1].replace(/,/g, ""), 10) * 10000;
  return null;
}

// 商品名をタイトルからクリーニング
function extractProductName(title: string): string {
  // 【...】を除去
  return title.replace(/【[^】]*】/g, "").trim();
}

async function scrapeTenbaiLaboRSS(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  try {
    const res = await fetch("https://tenbailabo.com/feed", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });

    $("item").each((_, el) => {
      const title = $(el).find("title").text();
      const content = $(el).find("content\\:encoded").text();
      const categories = $(el)
        .find("category")
        .map((_, c) => $(c).text())
        .get();

      const eventDate = extractDateFromTitle(title);
      if (!eventDate) return; // 日付が取れない記事はスキップ

      const name = extractProductName(title);
      if (!name) return;

      const price = extractPrice(content);
      if (!price) return; // 定価が不明な記事はスキップ

      const marketPrice = extractMarketPrice(content);
      const premiumRate =
        marketPrice && price
          ? Math.round((marketPrice / price) * 100) / 100
          : undefined;

      products.push({
        name,
        category: guessCategory(title, categories),
        price,
        market_price: marketPrice ?? undefined,
        premium_rate: premiumRate,
        event_date: eventDate,
        event_type: guessEventType(title),
        source: "転売博士",
      });
    });
  } catch (e) {
    console.error("[scrape] tenbailabo RSS error:", e);
  }
  return products;
}

async function scrapeTenbaiQuest(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  try {
    const res = await fetch("https://tenbaiquest.com/", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // トップページの記事リストからリンクを取得
    const links: string[] = [];
    $(".post a, .posts a, article a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("/resale/") && !links.includes(href)) {
        links.push(href);
      }
    });

    // 各記事ページをフェッチ（最大5件、負荷軽減）
    for (const link of links.slice(0, 5)) {
      try {
        const url = link.startsWith("http")
          ? link
          : `https://tenbaiquest.com${link}`;
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "SedoriCalendar/1.0" },
        });
        const pageHtml = await pageRes.text();
        const page$ = cheerio.load(pageHtml);

        const title = page$("h1").first().text().trim();
        if (!title) continue;

        const eventDate = extractDateFromTitle(title);
        if (!eventDate) continue;

        const bodyHtml = page$(".post_content, .entry-content, article").html() || "";
        const price = extractPrice(bodyHtml);
        if (!price) continue;

        const marketPrice = extractMarketPrice(bodyHtml);
        const premiumRate =
          marketPrice && price
            ? Math.round((marketPrice / price) * 100) / 100
            : undefined;

        const name = extractProductName(title);
        products.push({
          name,
          category: guessCategory(title, []),
          price,
          market_price: marketPrice ?? undefined,
          premium_rate: premiumRate,
          event_date: eventDate,
          event_type: guessEventType(title),
          source: "転売クエスト",
        });
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.error("[scrape] tenbaiquest error:", e);
  }
  return products;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();

  const results: ScrapedProduct[] = [];

  const [tenbaiLabo, tenbaiQuest] = await Promise.all([
    scrapeTenbaiLaboRSS(),
    scrapeTenbaiQuest(),
  ]);

  results.push(...tenbaiLabo, ...tenbaiQuest);

  // DBに挿入（重複チェック: 同名+同日のものはスキップ）
  let inserted = 0;
  const newProducts: ScrapedProduct[] = [];
  for (const product of results) {
    const { data: existing } = await db
      .from("products")
      .select("id")
      .eq("name", product.name)
      .eq("event_date", product.event_date)
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from("products").insert(product);
      if (!error) {
        inserted++;
        newProducts.push(product);
      }
    }
  }

  // 新規商品があればLINE通知
  if (newProducts.length > 0) {
    const messages = formatProductNotification(newProducts);
    await sendLineBroadcast(messages);
  }

  return NextResponse.json({
    message: `Scraped ${results.length} products, inserted ${inserted} new, notified ${newProducts.length}`,
    sources: {
      tenbaiLabo: tenbaiLabo.length,
      tenbaiQuest: tenbaiQuest.length,
    },
    timestamp: new Date().toISOString(),
  });
}
