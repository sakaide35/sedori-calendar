// 本日(2026-03-10)以降の商品をSupabaseに一括投入するスクリプト
// 使い方: SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-products.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zbgioemvqzfzgalggdgn.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY が必要です");
  console.error("Supabaseダッシュボード > Settings > API > service_role key をコピーして:");
  console.error("SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-products.ts");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey);

interface ProductInsert {
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
  official_url?: string;
}

interface ChannelInsert {
  product_id: string;
  channel_type: "store" | "online" | "lottery";
  name: string;
  url?: string;
  store_detail?: string;
}

const products: (ProductInsert & { channels?: Omit<ChannelInsert, "product_id">[] })[] = [
  // === ポケカ・トレカ ===
  {
    name: "ポケモンカードゲーム MEGA 拡張パック ニンジャスピナー",
    category: "card",
    price: 5400,
    event_date: "2026-03-13",
    event_type: "release",
    source: "転売クエスト",
    official_url: "https://www.pokemon-card.com/ex/m4/",
    channels: [
      { channel_type: "online", name: "ポケモンセンターオンライン", url: "https://www.pokemoncenter-online.com/" },
      { channel_type: "online", name: "Amazon" },
      { channel_type: "online", name: "楽天ブックス" },
      { channel_type: "online", name: "ノジマオンライン" },
    ],
  },
  {
    name: "ポケモンカードゲーム スペシャルBOX ポケモンセンタートウホク/ヒロシマ/フクオカ",
    category: "card",
    price: 2090,
    event_date: "2026-03-16",
    event_type: "lottery",
    source: "転売クエスト",
    channels: [
      { channel_type: "lottery", name: "ポケモンセンターオンライン", url: "https://www.pokemoncenter-online.com/" },
    ],
  },

  // === スニーカー ===
  {
    name: "NIKE x FRAGMENT CONCEPT TESTING MIND 001 BLACK",
    category: "sneaker",
    price: 13200,
    event_date: "2026-03-14",
    event_type: "lottery",
    source: "転売クエスト",
    official_url: "https://www.nike.com/jp/launch/t/mind-001-fragment-black",
    channels: [
      { channel_type: "store", name: "V.A.", store_detail: "東京・原宿 3/14" },
      { channel_type: "lottery", name: "SNKRS", url: "https://www.nike.com/jp/launch/t/mind-001-fragment-black" },
    ],
  },
  {
    name: "NIKE x FRAGMENT CONCEPT TESTING MIND 002 GREY",
    category: "sneaker",
    price: 20900,
    event_date: "2026-03-19",
    event_type: "lottery",
    source: "転売クエスト",
    official_url: "https://www.nike.com/jp/launch/t/mind-002-fragment-particle-grey",
    channels: [
      { channel_type: "lottery", name: "SNKRS", url: "https://www.nike.com/jp/launch/t/mind-002-fragment-particle-grey" },
    ],
  },
  {
    name: "NIKE x FRAGMENT CONCEPT TESTING MIND 002 BLACK",
    category: "sneaker",
    price: 20900,
    event_date: "2026-03-19",
    event_type: "lottery",
    source: "転売クエスト",
    official_url: "https://www.nike.com/jp/launch/t/mind-002-fragment-black",
    channels: [
      { channel_type: "lottery", name: "SNKRS", url: "https://www.nike.com/jp/launch/t/mind-002-fragment-black" },
    ],
  },
  {
    name: "NIKE WMNS MOON SHOE x JACQUEMUS",
    category: "sneaker",
    price: 25850,
    event_date: "2026-03-16",
    event_type: "lottery",
    source: "転売クエスト",
    channels: [
      { channel_type: "lottery", name: "SNKRS", url: "https://www.nike.com/jp/launch" },
      { channel_type: "online", name: "Forget-me-nots", url: "https://forgetmenots.jp" },
      { channel_type: "online", name: "Amazon" },
    ],
  },

  // === ブランド・アパレル ===
  {
    name: "LEVI'S VINTAGE CLOTHING S506XX 1944 JACKET 再販",
    category: "brand",
    price: 56100,
    event_date: "2026-03-13",
    event_end_date: "2026-03-14",
    event_type: "lottery",
    source: "転売クエスト",
    channels: [
      { channel_type: "lottery", name: "LEVI'S公式オンライン", url: "https://levi.jp" },
      { channel_type: "store", name: "LEVI'S直営店", store_detail: "東京・愛知・京都・大阪" },
      { channel_type: "online", name: "UNITED ARROWS 六本木ヒルズ" },
      { channel_type: "online", name: "JOURNAL STANDARD" },
    ],
  },

  // === カメラ ===
  {
    name: "RICOH GR III シリーズ 抽選販売",
    category: "camera",
    price: 133750,
    event_date: "2026-03-20",
    event_type: "lottery",
    source: "転売クエスト",
    note: "GR III/IIIx/HDF等複数モデル。抽選締切3/20",
    channels: [
      { channel_type: "lottery", name: "リコーイメージングストア" },
      { channel_type: "store", name: "GR SPACE TOKYO", store_detail: "店頭抽選 3/20まで" },
    ],
  },

  // === 時計 ===
  {
    name: "G-SHOCK × POTR DW-5600 再販",
    category: "watch",
    price: 25300,
    event_date: "2026-03-21",
    event_type: "lottery",
    source: "転売クエスト",
    channels: [
      { channel_type: "store", name: "阪急うめだ本店", store_detail: "店頭抽選 3/21 9:15", url: "https://www.hankyu-dept.co.jp/honten/shopnews/detail/12690548_2067.html#GSHOCK" },
      { channel_type: "store", name: "伊勢丹新宿店 メンズ館", store_detail: "店頭抽選 3/21 9:45", url: "https://www.imn.jp/post/108057208386?page=2" },
    ],
  },
  {
    name: "大塚ローテック 7.5号/6号/5号改/8号 Web抽選",
    category: "watch",
    price: 396000,
    event_date: "2026-03-23",
    event_type: "lottery",
    source: "転売クエスト",
    note: "転売禁止誓約書あり。定価39.6万〜99万円（モデルにより異なる）",
    official_url: "https://otsukalotec.base.shop/items/137949552",
    channels: [
      { channel_type: "lottery", name: "大塚ローテック公式", url: "https://otsukalotec.base.shop/items/137949552" },
    ],
  },

  // === ホビー ===
  {
    name: "バッドボーイズ 佐田正樹 とろみ君 9期",
    category: "hobby",
    price: 33000,
    event_date: "2026-03-10",
    event_end_date: "2026-03-22",
    event_type: "lottery",
    source: "転売クエスト",
    channels: [
      { channel_type: "store", name: "MEDICOM TOY NEXT", store_detail: "渋谷 店頭抽選 QRコード" },
    ],
  },
  {
    name: "S.H.Figuarts スーパーサイヤ人孫悟空 ゲンキダマツリEdition",
    category: "hobby",
    price: 8800,
    event_date: "2026-03-15",
    event_type: "release",
    source: "転売クエスト",
    channels: [
      { channel_type: "online", name: "プレミアムバンダイ" },
      { channel_type: "store", name: "DRAGON BALL STORE TOKYO" },
    ],
  },
  {
    name: "ドラゴンボール超 SMSP 孫悟空 身勝手の極意 ゲンキダマツリ SPECIAL ver.",
    category: "hobby",
    price: 12100,
    event_date: "2026-03-15",
    event_type: "release",
    source: "転売クエスト",
    channels: [
      { channel_type: "online", name: "プレミアムバンダイ" },
    ],
  },
  {
    name: "ドラゴンボール超 SMSP 孫悟空 ゲンキダマツリ SPECIAL ver.",
    category: "hobby",
    price: 9100,
    event_date: "2026-03-15",
    event_type: "release",
    source: "転売クエスト",
    channels: [
      { channel_type: "online", name: "プレミアムバンダイ" },
    ],
  },
  {
    name: "ドラゴンボール超 SMSP ベジータ ゲンキダマツリ SPECIAL ver.",
    category: "hobby",
    price: 9100,
    event_date: "2026-03-15",
    event_type: "release",
    source: "転売クエスト",
    channels: [
      { channel_type: "online", name: "プレミアムバンダイ" },
    ],
  },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const { channels, ...product } of products) {
    // 重複チェック
    const { data: existing } = await db
      .from("products")
      .select("id")
      .eq("name", product.name)
      .eq("event_date", product.event_date)
      .maybeSingle();

    if (existing) {
      console.log(`  skip(duplicate): ${product.name}`);
      skipped++;
      continue;
    }

    const { data: row, error } = await db
      .from("products")
      .insert(product)
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR: ${product.name}:`, error.message);
      continue;
    }

    console.log(`  inserted: ${product.name} (${row.id})`);
    inserted++;

    // 販売チャネル挿入
    if (channels && channels.length > 0 && row) {
      const channelRows = channels.map((ch) => ({
        product_id: row.id,
        ...ch,
      }));
      const { error: chErr } = await db.from("sales_channels").insert(channelRows);
      if (chErr) {
        console.error(`    channel error: ${chErr.message}`);
      }
    }
  }

  console.log(`\nDone: inserted ${inserted}, skipped ${skipped}`);
}

main().catch(console.error);
