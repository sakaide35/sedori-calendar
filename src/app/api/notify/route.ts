import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendLineBroadcast } from "@/lib/line";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function getWeekday(dateStr: string): string {
  return ["日","月","火","水","木","金","土"][new Date(dateStr + "T00:00:00+09:00").getDay()];
}

interface DBProduct {
  name: string;
  event_type: string;
  event_date: string;
  event_end_date: string | null;
  price: number;
  market_price: number | null;
}

function buildDaySection(label: string, dateStr: string, products: DBProduct[]): string {
  const lotteryStart = products.filter(p => p.event_date === dateStr && p.event_type === "lottery");
  const lotteryEnd = products.filter(p => p.event_end_date === dateStr && p.event_type === "lottery");
  const releases = products.filter(p => p.event_date === dateStr && (p.event_type === "release" || p.event_type === "restock"));

  if (lotteryStart.length === 0 && lotteryEnd.length === 0 && releases.length === 0) return "";

  let text = `■ ${label} ${dateStr.replace(/-/g, "/")}（${getWeekday(dateStr)}）\n`;

  if (releases.length > 0) {
    text += `📦 発売・再販\n`;
    for (const p of releases) text += `・${p.name}\n`;
  }
  if (lotteryStart.length > 0) {
    text += `🎯 抽選開始\n`;
    for (const p of lotteryStart) text += `・${p.name}\n`;
  }
  if (lotteryEnd.length > 0) {
    text += `⏰ 抽選締切\n`;
    for (const p of lotteryEnd) text += `・${p.name}\n`;
  }

  return text;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = toJSTDateString(now);
  const tomorrow = toJSTDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const db = getSupabaseAdmin();
  const { data: products, error } = await db
    .from("products")
    .select("name, event_type, event_date, event_end_date, price, market_price")
    .or(`event_date.eq.${today},event_end_date.eq.${today},event_date.eq.${tomorrow},event_end_date.eq.${tomorrow}`)
    .order("event_type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ message: "No products for today/tomorrow", today, tomorrow });
  }

  const todaySection = buildDaySection("本日", today, products as DBProduct[]);
  const tomorrowSection = buildDaySection("明日", tomorrow, products as DBProduct[]);

  if (!todaySection && !tomorrowSection) {
    return NextResponse.json({ message: "No events for today/tomorrow", today, tomorrow });
  }

  let text = "【せどりカレンダー】\n\n";
  if (todaySection) text += todaySection + "\n";
  if (tomorrowSection) text += tomorrowSection + "\n";
  text += `https://sedori-calendar.vercel.app/`;

  await sendLineBroadcast([{ type: "text", text }]);

  return NextResponse.json({
    message: "Sent morning LINE notification",
    today,
    tomorrow,
    count: products.length,
  });
}
