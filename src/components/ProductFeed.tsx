"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Product,
  Category,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  EVENT_TYPE_LABELS,
} from "@/types/product";

interface ProductFeedProps {
  products: Product[];
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return `${(price / 10000).toFixed(price % 10000 === 0 ? 0 : 1)}万円`;
  }
  return `${price.toLocaleString()}円`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[d.getDay()];
  return `${month}/${day}（${weekday}）`;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr === todayStr;
}

function isPast(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr < todayStr;
}

export default function ProductFeed({ products }: ProductFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");

  const filtered = selectedCategory === "all"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  // 日付ごとにグループ化（開始日と終了日のみ表示、期間中毎日は不要）
  const grouped = filtered.reduce<Record<string, { product: Product; label: string }[]>>((acc, p) => {
    // 開始日に表示
    if (!acc[p.eventDate]) acc[p.eventDate] = [];
    acc[p.eventDate].push({
      product: p,
      label: p.eventEndDate ? `${EVENT_TYPE_LABELS[p.eventType]}開始` : EVENT_TYPE_LABELS[p.eventType],
    });

    // 終了日がある場合、終了日にも表示
    if (p.eventEndDate && p.eventEndDate !== p.eventDate) {
      if (!acc[p.eventEndDate]) acc[p.eventEndDate] = [];
      acc[p.eventEndDate].push({
        product: p,
        label: `${EVENT_TYPE_LABELS[p.eventType]}締切`,
      });
    }
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const categories = Object.keys(CATEGORY_LABELS) as Category[];
  // 実際にデータがあるカテゴリだけ表示
  const activeCategories = categories.filter((c) =>
    products.some((p) => p.category === c)
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6 sticky top-0 bg-zinc-50 py-3 z-10 border-b border-zinc-200">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            selectedCategory === "all"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          すべて
        </button>
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              selectedCategory === cat
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Date groups */}
      {sortedDates.length === 0 ? (
        <p className="text-center text-zinc-400 py-12">該当する商品がありません</p>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              {/* Date header */}
              <div className={`flex items-center gap-3 mb-3 ${isPast(date) ? "opacity-50" : ""}`}>
                <div
                  className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    isToday(date)
                      ? "bg-blue-500 text-white"
                      : isPast(date)
                        ? "bg-zinc-300 text-zinc-600"
                        : "bg-zinc-800 text-white"
                  }`}
                >
                  {formatDate(date)}
                </div>
                {isToday(date) && (
                  <span className="text-xs font-bold text-blue-500">TODAY</span>
                )}
                <span className="text-xs text-zinc-400">{grouped[date].length}件</span>
              </div>

              {/* Product cards */}
              <div className="space-y-3">
                {grouped[date].map(({ product: p, label }) => (
                  <Link
                    key={`${p.id}-${label}`}
                    href={`/products/${p.id}`}
                    className={`block bg-white rounded-xl border border-zinc-200 p-4 hover:shadow-md transition ${
                      isPast(date) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] text-white font-medium ${CATEGORY_COLORS[p.category]}`}
                          >
                            {CATEGORY_LABELS[p.category]}
                          </span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            label.includes("締切")
                              ? "bg-red-100 text-red-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {label}
                          </span>
                          {p.note && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-700 font-medium">
                              注意
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-zinc-900 text-base leading-snug">
                          {p.name}
                        </h3>
                        {p.eventEndDate && (
                          <p className="text-xs text-zinc-400 mt-1">
                            期間: {formatDate(p.eventDate)} 〜 {formatDate(p.eventEndDate)}
                          </p>
                        )}
                        {p.source && (
                          <p className="text-xs text-zinc-400 mt-1">
                            情報元: {p.source}
                          </p>
                        )}
                      </div>

                      {/* Price info */}
                      <div className="text-right shrink-0">
                        <div className="text-sm text-zinc-500">
                          定価 <span className="font-medium text-zinc-800">{formatPrice(p.price)}</span>
                        </div>
                        {p.marketPrice && (
                          <div className="text-sm text-red-600 font-bold">
                            相場 {formatPrice(p.marketPrice)}
                          </div>
                        )}
                        {p.premiumRate && (
                          <div className={`text-lg font-black mt-1 ${
                            p.premiumRate >= 3
                              ? "text-red-600"
                              : p.premiumRate >= 1.5
                                ? "text-orange-500"
                                : "text-green-600"
                          }`}>
                            {p.premiumRate}倍
                          </div>
                        )}
                        {p.marketPrice && (
                          <div className="text-xs text-green-600 mt-0.5">
                            +{formatPrice(p.marketPrice - p.price)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
