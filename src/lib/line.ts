const LINE_API_URL = "https://api.line.me/v2/bot/message/broadcast";

interface LineMessage {
  type: "text";
  text: string;
}

export async function sendLineBroadcast(messages: LineMessage[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("[LINE] No channel access token configured");
    return;
  }

  const res = await fetch(LINE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[LINE] Broadcast failed:", res.status, body);
  }
}

export function formatProductNotification(products: {
  name: string;
  price: number;
  market_price?: number;
  premium_rate?: number;
  event_date: string;
  event_type: string;
  source: string;
}[]): LineMessage[] {
  if (products.length === 0) return [];

  const eventTypeLabel: Record<string, string> = {
    release: "発売",
    lottery: "抽選",
    restock: "再販",
  };

  let text = `【新着${products.length}件】せどりカレンダー\n\n`;

  for (const p of products.slice(0, 5)) {
    const type = eventTypeLabel[p.event_type] || p.event_type;
    text += `${type} ${p.name}\n`;
    text += `定価: ${p.price.toLocaleString()}円`;
    if (p.market_price) {
      text += ` → 相場: ${p.market_price.toLocaleString()}円`;
    }
    if (p.premium_rate) {
      text += `（${p.premium_rate}倍）`;
    }
    text += `\n日程: ${p.event_date}\n`;
    text += `情報元: ${p.source}\n\n`;
  }

  if (products.length > 5) {
    text += `...他${products.length - 5}件\n\n`;
  }

  text += `詳細はこちら\nhttps://sedori-calendar.vercel.app/`;

  return [{ type: "text", text }];
}
