import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface ScrapedSalesChannel {
  channel_type: "store" | "online" | "lottery";
  name: string;
  url?: string;
  store_detail?: string;
}

interface ScrapedProduct {
  name: string;
  category: string;
  price: number;
  market_price?: number;
  premium_rate?: number;
  estimated_resale_price?: number;
  event_date: string;
  event_end_date?: string;
  event_type: "release" | "lottery" | "restock";
  source: string;
  note?: string;
  official_url?: string;
  salesChannels?: ScrapedSalesChannel[];
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

// タイトルや本文から日付を抽出（複数パターン対応）
function extractDateFromText(text: string): string | null {
  // パターン1: 2026/3/1 or 2026/03/01 or 2026-03-01
  const m1 = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  }
  // パターン2: 2026年3月1日
  const m2 = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  }
  // パターン3: 3月1日（年なし→今年と仮定）
  const m3 = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (m3) {
    const year = new Date().getFullYear();
    return `${year}-${m3[1].padStart(2, "0")}-${m3[2].padStart(2, "0")}`;
  }
  // パターン4: 3/1（年なし→今年と仮定）
  const m4 = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (m4) {
    const month = parseInt(m4[1], 10);
    const day = parseInt(m4[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return `${year}-${m4[1].padStart(2, "0")}-${m4[2].padStart(2, "0")}`;
    }
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
  // 「価格：19,800円」
  const m3 = text.match(/価格[：:]?\s*([0-9,]+)\s*円/);
  if (m3) return parseInt(m3[1].replace(/,/g, ""), 10);
  // 「¥19,800」
  const m4 = text.match(/¥\s*([0-9,]+)/);
  if (m4) return parseInt(m4[1].replace(/,/g, ""), 10);
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

// ツイートから推定転売価格を抽出（「→22,000円前後」「→10万前後」等）
function extractEstimatedResalePrice(text: string): number | null {
  // 「→22,000円前後」「→22,000円」
  const m1 = text.match(/→\s*(?:約)?([0-9,]+)\s*円/);
  if (m1) return parseInt(m1[1].replace(/,/g, ""), 10);
  // 「→10万円前後」「→100万前後」
  const m2 = text.match(/→\s*(?:約)?([0-9,]+)\s*万\s*円/);
  if (m2) return parseInt(m2[1].replace(/,/g, ""), 10) * 10000;
  return null;
}

// ツイートから開始日と締切日を抽出
function extractEventDates(text: string): { startDate: string | null; endDate: string | null } {
  let startDate: string | null = null;
  let endDate: string | null = null;

  // 「〆切」「締切」に紐づく日付
  const deadlinePatterns = [
    /(?:〆切|締切|締め切り|まで).*?(\d{1,2})月(\d{1,2})日/,
    /(\d{1,2})月(\d{1,2})日.*?(?:〆切|締切|締め切り|まで)/,
    /(?:〆切|締切|締め切り|まで).*?(\d{1,2})\/(\d{1,2})/,
    /(\d{1,2})\/(\d{1,2}).*?(?:〆切|締切|締め切り|まで)/,
    /〜\s*(\d{1,2})\/(\d{1,2})/,
    /〜\s*(\d{1,2})月(\d{1,2})日/,
  ];
  for (const pat of deadlinePatterns) {
    const m = text.match(pat);
    if (m) {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const year = new Date().getFullYear();
        endDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        break;
      }
    }
  }

  // 「開始」「発売」に紐づく日付
  const startPatterns = [
    /(?:開始|発売|スタート).*?(\d{1,2})月(\d{1,2})日/,
    /(\d{1,2})月(\d{1,2})日.*?(?:開始|発売|スタート)/,
    /(?:本日|今日)(\d{1,2})月(\d{1,2})日/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}).*?(?:発売|開始)/,
    /(?:発売|開始).*?(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
  ];
  for (const pat of startPatterns) {
    const m = text.match(pat);
    if (m) {
      if (m.length === 4) {
        // YYYY/MM/DD pattern
        startDate = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      } else {
        const month = parseInt(m[1], 10);
        const day = parseInt(m[2], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const year = new Date().getFullYear();
          startDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
      break;
    }
  }

  // 「来月5月22日に発売予定」のようなパターン
  const futureDateMatch = text.match(/(\d{1,2})月(\d{1,2})日.*?(?:に|から)?(?:発売|開始|予定)/);
  if (!startDate && futureDateMatch) {
    const month = parseInt(futureDateMatch[1], 10);
    const day = parseInt(futureDateMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      startDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 開始日がなく締切日だけある場合 → extractDateFromTextで最初の日付を開始日に
  if (!startDate && endDate) {
    const fallback = extractDateFromText(text);
    if (fallback && fallback !== endDate) {
      startDate = fallback;
    } else {
      // 締切日しかない場合、締切日を開始日にはしない（endDateのみ返す）
      startDate = null;
    }
  }

  // 開始日だけある場合はそのまま
  // 両方ない場合は従来のextractDateFromTextにフォールバック
  if (!startDate && !endDate) {
    startDate = extractDateFromText(text);
  }

  // 開始日 > 締切日の場合は入れ替え
  if (startDate && endDate && startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  return { startDate, endDate };
}

// 本文から公式URL・抽選URLを抽出
function extractOfficialUrl(html: string): string | null {
  const $ = cheerio.load(html);
  let officialUrl: string | null = null;

  $("a").each((_, el) => {
    if (officialUrl) return;
    const href = $(el).attr("href") || "";
    const linkText = $(el).text().trim().toLowerCase();
    // 公式サイト、公式ページ、抽選ページ、販売ページ等のリンク
    if (
      (/公式|official/i.test(linkText) && href.startsWith("http")) ||
      /抽選(ページ|応募|エントリー|受付)/i.test(linkText) ||
      /販売ページ|購入ページ|shop.*page/i.test(linkText) ||
      /snkrs\.com|nike\.com.*launch|adidas\.com.*yeezy/i.test(href)
    ) {
      officialUrl = href;
    }
  });

  return officialUrl;
}

// 本文から販売場所・抽選情報を抽出
function extractSalesChannels(html: string): ScrapedSalesChannel[] {
  const $ = cheerio.load(html);
  const text = $.text();
  const channels: ScrapedSalesChannel[] = [];
  const seen = new Set<string>();

  // リンク付き販売先を抽出
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const linkText = $(el).text().trim();
    if (!href || !linkText || href.startsWith("#")) return;

    // SNKRS / スニーカーズ
    if (/snkrs|nike\.com.*launch/i.test(href) || /snkrs|スニーカーズ/i.test(linkText)) {
      const key = "lottery-SNKRS";
      if (!seen.has(key)) {
        seen.add(key);
        channels.push({ channel_type: "lottery", name: "SNKRS", url: href });
      }
    }
    // 抽選リンク
    else if (/抽選|raffle|応募/i.test(linkText)) {
      const name = linkText.replace(/[で|の]?抽選.*$/, "").replace(/応募.*$/, "").trim() || linkText;
      const key = `lottery-${name}`;
      if (!seen.has(key) && name.length < 50) {
        seen.add(key);
        channels.push({ channel_type: "lottery", name, url: href });
      }
    }
    // オンラインストアリンク
    else if (/購入|販売|shop|store|通販|オンライン/i.test(linkText) && href.startsWith("http")) {
      const name = linkText.replace(/(で|の)?(購入|販売|通販|オンライン).*$/, "").trim() || linkText;
      const key = `online-${name}`;
      if (!seen.has(key) && name.length < 50) {
        seen.add(key);
        channels.push({ channel_type: "online", name, url: href });
      }
    }
  });

  // テキストから販売店を抽出
  const storePatterns = [
    { pattern: /(?:atmos|アトモス)/i, name: "atmos" },
    { pattern: /(?:UNDEFEATED|アンディフィーテッド)/i, name: "UNDEFEATED" },
    { pattern: /(?:ABC-?MART|ABCマート)/i, name: "ABC-MART" },
    { pattern: /(?:UNITED ARROWS|ユナイテッドアローズ)/i, name: "UNITED ARROWS" },
    { pattern: /(?:BEAMS|ビームス)/i, name: "BEAMS" },
    { pattern: /(?:DOVER STREET MARKET|DSM)/i, name: "DOVER STREET MARKET" },
    { pattern: /(?:Nike\s*(?:直営|公式|ストア|店舗))/i, name: "Nike" },
    { pattern: /(?:adidas\s*(?:直営|公式|ストア|店舗))/i, name: "adidas" },
    { pattern: /(?:Supreme\s*(?:店舗|オンライン|公式))/i, name: "Supreme" },
    { pattern: /(?:SNKRDUNK|スニダン)/i, name: "SNKRDUNK" },
    { pattern: /(?:StockX)/i, name: "StockX" },
    { pattern: /(?:ポケモンセンター)/i, name: "ポケモンセンター" },
    { pattern: /(?:ポケモンストア)/i, name: "ポケモンストア" },
    { pattern: /(?:Amazon|アマゾン)/i, name: "Amazon" },
    { pattern: /(?:楽天)/i, name: "楽天" },
  ];

  for (const { pattern, name } of storePatterns) {
    if (pattern.test(text)) {
      const isOnline = new RegExp(`${name}.*(?:オンライン|通販|公式サイト|EC)`, "i").test(text);
      const isStore = new RegExp(`${name}.*(?:店頭|店舗|直営)`, "i").test(text);
      if (isOnline && !seen.has(`online-${name}`)) {
        seen.add(`online-${name}`);
        channels.push({ channel_type: "online", name });
      }
      if (isStore && !seen.has(`store-${name}`)) {
        seen.add(`store-${name}`);
        channels.push({ channel_type: "store", name });
      }
      if (!isOnline && !isStore && !seen.has(`online-${name}`) && !seen.has(`store-${name}`)) {
        seen.add(`online-${name}`);
        channels.push({ channel_type: "online", name });
      }
    }
  }

  return channels;
}

// 商品名をタイトルからクリーニング
function extractProductName(title: string): string {
  // 【...】を除去
  return title.replace(/【[^】]*】/g, "").trim();
}

// ツイート本文から商品名を抽出
function extractProductNameFromTweet(text: string): string | null {
  // 【商品名】形式（転売博士など）
  const bracket = text.match(/【([^】]+)】/);
  if (bracket && bracket[1].length >= 3) return bracket[1].trim();

  // 「商品名」形式（ポケカちゃんなど）
  const paren = text.match(/「([^」]+)」/);
  if (paren && paren[1].length >= 3) return paren[1].trim();

  // 先頭行から取得（URLやハッシュタグを除去）
  const firstLine = text.split(/\n/)[0]
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\S+/g, "")
    .replace(/[🚨💡⚠️🔥🚀⭕️✅❗️📢🎁]/gu, "")
    .trim();
  if (firstLine.length >= 3 && firstLine.length <= 100) return firstLine;

  return null;
}

async function scrapeTenbaiLaboRSS(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const log: string[] = [];
  try {
    const res = await fetch("https://tenbailabo.com/feed", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    if (!res.ok) {
      log.push(`tenbailabo RSS: HTTP ${res.status}`);
      console.error("[scrape] tenbailabo RSS HTTP error:", res.status);
      return products;
    }
    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });

    const items = $("item");
    log.push(`tenbailabo: ${items.length} items found`);

    items.each((_, el) => {
      const title = $(el).find("title").text();
      const content = $(el).find("content\\:encoded").text();
      const description = $(el).find("description").text();
      const categories = $(el)
        .find("category")
        .map((_, c) => $(c).text())
        .get();

      // タイトルから日付を抽出、なければ本文から
      let eventDate = extractDateFromText(title);
      if (!eventDate && content) {
        eventDate = extractDateFromText(cheerio.load(content).text());
      }
      if (!eventDate && description) {
        eventDate = extractDateFromText(description);
      }
      if (!eventDate) {
        log.push(`  skip(no date): ${title.substring(0, 50)}`);
        return;
      }

      const name = extractProductName(title);
      if (!name) return;

      const bodyHtml = content || description || "";
      const price = extractPrice(bodyHtml);
      // 定価がなくてもスキップしない（0円として登録、後で更新可能）

      const marketPrice = extractMarketPrice(bodyHtml);
      const actualPrice = price ?? 0;
      const premiumRate =
        marketPrice && actualPrice > 0
          ? Math.round((marketPrice / actualPrice) * 100) / 100
          : undefined;

      const salesChannels = extractSalesChannels(bodyHtml);
      const officialUrl = extractOfficialUrl(bodyHtml);

      products.push({
        name,
        category: guessCategory(title, categories),
        price: actualPrice,
        market_price: marketPrice ?? undefined,
        premium_rate: premiumRate,
        event_date: eventDate,
        event_type: guessEventType(title),
        source: "転売博士",
        official_url: officialUrl ?? undefined,
        salesChannels: salesChannels.length > 0 ? salesChannels : undefined,
      });
    });
  } catch (e) {
    console.error("[scrape] tenbailabo RSS error:", e);
  }
  console.log("[scrape] tenbailabo:", log.join(", "));
  return products;
}

async function scrapeTenbaiQuest(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const log: string[] = [];
  try {
    const res = await fetch("https://tenbaiquest.com/", {
      headers: { "User-Agent": "SedoriCalendar/1.0" },
    });
    if (!res.ok) {
      log.push(`tenbaiquest: HTTP ${res.status}`);
      console.error("[scrape] tenbaiquest HTTP error:", res.status);
      return products;
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // トップページの記事リストからリンクを取得（複数セレクタ対応）
    const links: string[] = [];
    // 全カテゴリの記事リンクを取得
    const articlePaths = ["/resale/", "/sneakers/", "/figure/", "/clothes/", "/game/", "/tenbai/", "/sedori/", "/limited/"];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (
        href &&
        articlePaths.some((p) => href.includes(p)) &&
        !href.includes("/limited/paid-") && // 有料記事は除外
        !links.includes(href)
      ) {
        links.push(href);
      }
    });

    // 上記でヒットしない場合、記事っぽいリンクを広く取得
    if (links.length === 0) {
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (
          href.startsWith("https://tenbaiquest.com/") &&
          !href.endsWith("/") &&
          href !== "https://tenbaiquest.com" &&
          !href.includes("/category/") &&
          !href.includes("/tag/") &&
          !href.includes("/page/") &&
          !links.includes(href)
        ) {
          links.push(href);
        }
      });
    }

    log.push(`tenbaiquest: ${links.length} article links found`);

    // 各記事ページをフェッチ（最大20件）
    for (const link of links.slice(0, 20)) {
      try {
        const url = link.startsWith("http")
          ? link
          : `https://tenbaiquest.com${link}`;
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "SedoriCalendar/1.0" },
        });
        if (!pageRes.ok) continue;
        const pageHtml = await pageRes.text();
        const page$ = cheerio.load(pageHtml);

        const title = page$("h1").first().text().trim();
        if (!title) continue;

        // タイトルから日付、なければ本文から
        const bodyHtml = page$(".post_content, .entry-content, article, .main-content, main").html() || "";
        let eventDate = extractDateFromText(title);
        if (!eventDate) {
          eventDate = extractDateFromText(page$(bodyHtml).text() || page$.text());
        }
        if (!eventDate) {
          log.push(`  skip(no date): ${title.substring(0, 50)}`);
          continue;
        }

        const price = extractPrice(bodyHtml);
        const actualPrice = price ?? 0;

        const marketPrice = extractMarketPrice(bodyHtml);
        const premiumRate =
          marketPrice && actualPrice > 0
            ? Math.round((marketPrice / actualPrice) * 100) / 100
            : undefined;

        const name = extractProductName(title);
        const salesChannels = extractSalesChannels(bodyHtml);
        const officialUrl = extractOfficialUrl(bodyHtml);

        products.push({
          name,
          category: guessCategory(title, []),
          price: actualPrice,
          market_price: marketPrice ?? undefined,
          premium_rate: premiumRate,
          event_date: eventDate,
          event_type: guessEventType(title),
          source: "転売クエスト",
          official_url: officialUrl ?? undefined,
          salesChannels: salesChannels.length > 0 ? salesChannels : undefined,
        });
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.error("[scrape] tenbaiquest error:", e);
  }
  console.log("[scrape] tenbaiquest:", log.join(", "));
  return products;
}

// Twitter API v2 でユーザーのツイートを取得
interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

async function fetchTweetsFromX(username: string): Promise<{ tweets: Tweet[]; error?: string }> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    return { tweets: [], error: "TWITTER_BEARER_TOKEN not set" };
  }

  try {
    const searchUrl = `https://api.x.com/2/tweets/search/recent?query=from:${username}&max_results=20&tweet.fields=created_at,text`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { tweets: [], error: `HTTP ${res.status}: ${body.substring(0, 200)}` };
    }

    const json = await res.json();
    return { tweets: json.data ?? [] };
  } catch (e) {
    return { tweets: [], error: String(e) };
  }
}

// ポケカちゃん (@pokecachan) のXポストを取得
async function scrapePokecachan(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const log: string[] = [];

  const { tweets, error } = await fetchTweetsFromX("pokecachan");
  if (error) {
    log.push(`pokecachan: ${error}`);
    console.error("[scrape] pokecachan:", error);
    console.log("[scrape] pokecachan:", log.join(", "));
    return products;
  }

  log.push(`pokecachan: ${tweets.length} tweets fetched`);

  for (const tweet of tweets) {
    const text = tweet.text;

    const isRelevant = /ポケカ|ポケモン|トレカ|発売|抽選|再販|プレ値|相場/.test(text);
    if (!isRelevant) continue;

    const { startDate, endDate } = extractEventDates(text);
    const eventDate = startDate || endDate;
    if (!eventDate) continue;

    const name = extractProductNameFromTweet(text);
    if (!name) continue;

    const price = extractPrice(`<div>${text}</div>`);
    const marketPrice = extractMarketPrice(`<div>${text}</div>`);
    const actualPrice = price ?? 0;
    const premiumRate =
      marketPrice && actualPrice > 0
        ? Math.round((marketPrice / actualPrice) * 100) / 100
        : undefined;

    products.push({
      name,
      category: "card",
      price: actualPrice,
      market_price: marketPrice ?? undefined,
      premium_rate: premiumRate,
      event_date: startDate || eventDate,
      event_end_date: startDate && endDate && startDate !== endDate ? endDate : undefined,
      event_type: guessEventType(text),
      source: "ポケカちゃん",
    });
  }

  console.log("[scrape] pokecachan:", log.join(", "));
  return products;
}

// 転売博士 (@tenbai_hakase) のXポストを取得
async function scrapeTenbaiHakase(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const log: string[] = [];

  const { tweets, error } = await fetchTweetsFromX("tenbai_hakase");
  if (error) {
    log.push(`tenbai_hakase: ${error}`);
    console.error("[scrape] tenbai_hakase:", error);
    console.log("[scrape] tenbai_hakase:", log.join(", "));
    return products;
  }

  log.push(`tenbai_hakase: ${tweets.length} tweets fetched`);

  for (const tweet of tweets) {
    const text = tweet.text;

    const isRelevant = /発売|抽選|再販|プレ値|相場|転売|せどり|限定|値上|高騰/.test(text);
    if (!isRelevant) continue;

    const { startDate, endDate } = extractEventDates(text);
    const eventDate = startDate || endDate;
    if (!eventDate) continue;

    const name = extractProductNameFromTweet(text);
    if (!name) continue;

    const price = extractPrice(`<div>${text}</div>`);
    const marketPrice = extractMarketPrice(`<div>${text}</div>`);
    const actualPrice = price ?? 0;
    const premiumRate =
      marketPrice && actualPrice > 0
        ? Math.round((marketPrice / actualPrice) * 100) / 100
        : undefined;

    const estimatedResalePrice = extractEstimatedResalePrice(text);

    products.push({
      name,
      category: guessCategory(text, []),
      price: actualPrice,
      market_price: marketPrice ?? undefined,
      premium_rate: premiumRate,
      estimated_resale_price: estimatedResalePrice ?? undefined,
      event_date: startDate || eventDate,
      event_end_date: startDate && endDate && startDate !== endDate ? endDate : undefined,
      event_type: guessEventType(text),
      source: "転売博士X",
    });
  }

  console.log("[scrape] tenbai_hakase:", log.join(", "));
  return products;
}

// スニダンから最安値を取得
async function scrapeSnkrdunkPrice(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // スニダンの最安値表示を取得（複数パターン対応）
    const text = $.text();
    // 「¥12,345」形式
    const m1 = text.match(/¥([0-9,]+)/);
    if (m1) return parseInt(m1[1].replace(/,/g, ""), 10);
    // 「12,345円」形式
    const m2 = text.match(/([0-9,]{4,})\s*円/);
    if (m2) return parseInt(m2[1].replace(/,/g, ""), 10);

    return null;
  } catch (e) {
    console.error(`[scrape] snkrdunk error for ${url}:`, e);
    return null;
  }
}

// スニダンURLが登録済みの商品の相場を更新
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateSnkrdunkPrices(db: any): Promise<number> {
  const { data: products } = await db
    .from("products")
    .select("id, name, price, snkrdunk_url")
    .not("snkrdunk_url", "is", null) as { data: { id: string; name: string; price: number; snkrdunk_url: string }[] | null };

  if (!products || products.length === 0) return 0;

  let updated = 0;
  for (const p of products) {
    const marketPrice = await scrapeSnkrdunkPrice(p.snkrdunk_url);
    if (marketPrice && marketPrice > 0) {
      const premiumRate = Math.round((marketPrice / p.price) * 100) / 100;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any)
        .from("products")
        .update({ market_price: marketPrice, premium_rate: premiumRate })
        .eq("id", p.id);
      if (!error) updated++;
    }
  }
  return updated;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();

  const results: ScrapedProduct[] = [];

  const [tenbaiLabo, tenbaiQuest, pokecachan, tenbaiHakase] = await Promise.all([
    scrapeTenbaiLaboRSS(),
    scrapeTenbaiQuest(),
    scrapePokecachan(),
    scrapeTenbaiHakase(),
  ]);

  results.push(...tenbaiLabo, ...tenbaiQuest, ...pokecachan, ...tenbaiHakase);

  // DBに挿入（重複チェック: 同名+同日のものはスキップ）
  let inserted = 0;
  let skipped = 0;
  for (const product of results) {
    const { data: existing } = await db
      .from("products")
      .select("id")
      .eq("name", product.name)
      .eq("event_date", product.event_date)
      .maybeSingle();

    if (!existing) {
      const { salesChannels, ...productData } = product;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedRow, error } = await (db as any)
        .from("products")
        .insert(productData)
        .select("id")
        .single();
      if (!error && insertedRow) {
        inserted++;
        // 販売場所を挿入
        if (salesChannels && salesChannels.length > 0) {
          const channelRows = salesChannels.map((ch) => ({
            product_id: insertedRow.id,
            channel_type: ch.channel_type,
            name: ch.name,
            url: ch.url ?? null,
            store_detail: ch.store_detail ?? null,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).from("sales_channels").insert(channelRows);
        }
      } else if (error) {
        console.error("[scrape] insert error:", error.message, "product:", product.name);
      }
    } else {
      // 既存レコードでも推定転売価格・締切日が新たに取れた場合は更新
      const updates: Record<string, unknown> = {};
      if (product.estimated_resale_price) updates.estimated_resale_price = product.estimated_resale_price;
      if (product.event_end_date) updates.event_end_date = product.event_end_date;
      if (Object.keys(updates).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from("products").update(updates).eq("id", existing.id);
      }
      skipped++;
    }
  }

  // スニダンURLが登録済みの商品の相場を更新
  const snkrdunkUpdated = await updateSnkrdunkPrices(db);

  return NextResponse.json({
    message: `Scraped ${results.length} products, inserted ${inserted} new, skipped ${skipped} duplicates, snkrdunk updated ${snkrdunkUpdated}`,
    sources: {
      tenbaiLabo: tenbaiLabo.length,
      tenbaiQuest: tenbaiQuest.length,
      pokecachan: pokecachan.length,
      tenbaiHakase: tenbaiHakase.length,
    },
    snkrdunkUpdated,
    timestamp: new Date().toISOString(),
  });
}
