"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Product,
  Category,
  SalesChannel,
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

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem("sedori-favorites");
    if (stored) {
      setFavorites(new Set(JSON.parse(stored)));
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("sedori-favorites", JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favorites, toggle };
}

function formatChannelLabel(ch: SalesChannel): string {
  if (ch.channelType === "lottery") return `抽選 ${ch.name}`;
  const methods: string[] = [];
  if (ch.storeDetail) {
    methods.push(`店頭（${ch.storeDetail}）`);
  } else if (ch.channelType === "store") {
    methods.push("店頭");
  }
  if (ch.channelType === "online" || ch.url) {
    methods.push("オンライン");
  }
  return `${ch.name} ${methods.join("・")}`;
}

function SalesChannelDisplay({ channels }: { channels: SalesChannel[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group channels: store+online grouped by name, lottery separate
  const grouped: { label: string; url?: string; channelType: string }[] = [];
  const byName: Record<string, { types: Set<string>; url?: string; storeDetail?: string }> = {};

  for (const ch of channels) {
    if (ch.channelType === "lottery") {
      grouped.push({ label: `抽選 ${ch.name}`, url: ch.url, channelType: "lottery" });
    } else {
      if (!byName[ch.name]) byName[ch.name] = { types: new Set() };
      byName[ch.name].types.add(ch.channelType);
      if (ch.url) byName[ch.name].url = ch.url;
      if (ch.storeDetail) byName[ch.name].storeDetail = ch.storeDetail;
    }
  }

  for (const [name, info] of Object.entries(byName)) {
    const methods: string[] = [];
    if (info.types.has("store")) {
      methods.push(info.storeDetail ? `店頭（${info.storeDetail}）` : "店頭");
    }
    if (info.types.has("online")) {
      methods.push("オンライン");
    }
    grouped.push({
      label: `${name} ${methods.join("・")}`,
      url: info.url,
      channelType: info.types.has("online") ? "online" : "store",
    });
  }

  const visible = expanded ? grouped : grouped.slice(0, 5);
  const hasMore = grouped.length > 5;

  return (
    <div className="mt-2 space-y-0.5">
      {visible.map((ch, i) => (
        <div key={i} className="text-xs text-zinc-600 flex items-center gap-1">
          {ch.url ? (
            <a
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:underline"
            >
              {ch.label}
            </a>
          ) : (
            <span>{ch.label}</span>
          )}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {expanded ? "閉じる" : `…他${grouped.length - 5}件を見る`}
        </button>
      )}
    </div>
  );
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProductFeed({ products }: ProductFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | "all" | "favorites">("all");
  const [showPast, setShowPast] = useState(false);
  const { favorites, toggle } = useFavorites();

  const filtered =
    selectedCategory === "favorites"
      ? products.filter((p) => favorites.has(p.id))
      : selectedCategory === "all"
        ? products
        : products.filter((p) => p.category === selectedCategory);

  // 日付ごとにグループ化（開始日と終了日のみ表示、期間中毎日は不要）
  const grouped = filtered.reduce<Record<string, { product: Product; label: string }[]>>((acc, p) => {
    if (!acc[p.eventDate]) acc[p.eventDate] = [];
    acc[p.eventDate].push({
      product: p,
      label: p.eventEndDate ? `${EVENT_TYPE_LABELS[p.eventType]}開始` : EVENT_TYPE_LABELS[p.eventType],
    });

    if (p.eventEndDate && p.eventEndDate !== p.eventDate) {
      if (!acc[p.eventEndDate]) acc[p.eventEndDate] = [];
      acc[p.eventEndDate].push({
        product: p,
        label: `${EVENT_TYPE_LABELS[p.eventType]}締切`,
      });
    }
    return acc;
  }, {});

  const todayStr = getTodayStr();
  const allDates = Object.keys(grouped).sort();
  const futureDates = allDates.filter((d) => d >= todayStr);
  const pastDates = allDates.filter((d) => d < todayStr).reverse();
  const sortedDates = showPast ? pastDates : futureDates;

  const categories = Object.keys(CATEGORY_LABELS) as Category[];
  const activeCategories = categories.filter((c) =>
    products.some((p) => p.category === c)
  );
  const pastCount = pastDates.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6 sticky top-0 bg-zinc-50 py-3 z-10 border-b border-zinc-200">
        <button
          onClick={() => setSelectedCategory("favorites")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            selectedCategory === "favorites"
              ? "bg-yellow-500 text-white"
              : "bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          ★ お気に入り
        </button>
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

      {/* Time tab */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setShowPast(false)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            !showPast ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
          }`}
        >
          今後
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            showPast ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
          }`}
        >
          過去 {pastCount > 0 && `(${pastCount})`}
        </button>
      </div>

      {/* Date groups */}
      {sortedDates.length === 0 ? (
        <p className="text-center text-zinc-400 py-12">
          {selectedCategory === "favorites"
            ? "お気に入りに追加された商品がありません"
            : showPast
              ? "過去の商品がありません"
              : "今後の予定がありません"}
        </p>
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
                  <div
                    key={`${p.id}-${label}`}
                    className={`bg-white rounded-xl border border-zinc-200 p-4 hover:shadow-md transition ${
                      isPast(date) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <button
                            onClick={() => toggle(p.id)}
                            className={`text-lg leading-none ${
                              favorites.has(p.id)
                                ? "text-yellow-400"
                                : "text-zinc-300 hover:text-yellow-300"
                            }`}
                          >
                            {favorites.has(p.id) ? "★" : "☆"}
                          </button>
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
                        <Link href={`/products/${p.id}`}>
                          <h3 className="font-bold text-zinc-900 text-base leading-snug hover:text-blue-600 transition">
                            {p.name}
                          </h3>
                        </Link>
                        {p.eventEndDate && (
                          <p className="text-xs text-zinc-400 mt-1">
                            期間: {formatDate(p.eventDate)} 〜 {formatDate(p.eventEndDate)}
                          </p>
                        )}
                        {p.salesChannels && p.salesChannels.length > 0 && (
                          <SalesChannelDisplay channels={p.salesChannels} />
                        )}
                      </div>

                      {/* Price info */}
                      <div className="text-right shrink-0">
                        <div className="text-sm text-zinc-500">
                          定価 <span className="font-medium text-zinc-800">{formatPrice(p.price)}</span>
                        </div>
                        {p.estimatedResalePrice && (
                          <div className="text-sm text-red-600 font-bold">
                            転売目安 {formatPrice(p.estimatedResalePrice)}
                          </div>
                        )}
                        {p.marketPrice && (p.snkrdunkUrl || p.eventType === "restock") && (
                          <>
                            <div className="text-sm text-red-600 font-bold">
                              相場 {formatPrice(p.marketPrice)}
                            </div>
                            <div className="text-xs text-green-600 mt-0.5">
                              +{formatPrice(p.marketPrice - p.price)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
