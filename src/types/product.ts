export type Category =
  | "camera"
  | "watch"
  | "whisky"
  | "hobby"
  | "gpu"
  | "instrument"
  | "brand"
  | "card"
  | "sneaker";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number; // 定価（円）
  marketPrice?: number; // 市場相場（円）
  premiumRate?: number; // プレミア率（例: 1.5）
  eventDate: string; // 発売日 or 抽選日（YYYY-MM-DD）
  eventEndDate?: string; // 抽選終了日（YYYY-MM-DD）
  eventType: "release" | "lottery" | "restock"; // 発売 / 抽選 / 再販
  source?: string; // 情報ソース
  note?: string; // 備考（転売禁止誓約等）
}

export const CATEGORY_LABELS: Record<Category, string> = {
  camera: "カメラ",
  watch: "時計",
  whisky: "ウイスキー",
  hobby: "ホビー",
  gpu: "GPU",
  instrument: "楽器・オーディオ",
  brand: "ブランド・アパレル",
  card: "トレカ",
  sneaker: "スニーカー",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  camera: "bg-blue-500",
  watch: "bg-amber-500",
  whisky: "bg-orange-700",
  hobby: "bg-purple-500",
  gpu: "bg-green-500",
  instrument: "bg-pink-500",
  brand: "bg-rose-500",
  card: "bg-yellow-500",
  sneaker: "bg-teal-500",
};

export const EVENT_TYPE_LABELS: Record<Product["eventType"], string> = {
  release: "発売",
  lottery: "抽選",
  restock: "再販",
};
