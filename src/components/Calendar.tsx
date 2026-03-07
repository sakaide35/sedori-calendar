"use client";

import { useState } from "react";
import {
  Product,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  EVENT_TYPE_LABELS,
} from "@/types/product";

interface CalendarProps {
  products: Product[];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return `${(price / 10000).toFixed(price % 10000 === 0 ? 0 : 1)}万`;
  }
  return price.toLocaleString();
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function Calendar({ products }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const getProductsForDay = (day: number): Product[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return products.filter((p) => {
      if (p.eventDate === dateStr) return true;
      if (p.eventEndDate && p.eventDate <= dateStr && p.eventEndDate >= dateStr)
        return true;
      return false;
    });
  };

  const isToday = (day: number): boolean => {
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    );
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition"
        >
          ← 前月
        </button>
        <h2 className="text-2xl font-bold text-zinc-900">
          {year}年 {month + 1}月
        </h2>
        <button
          onClick={nextMonth}
          className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition"
        >
          翌月 →
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`text-center text-sm font-semibold py-2 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-zinc-200">
        {cells.map((day, idx) => {
          const dayProducts = day ? getProductsForDay(day) : [];
          const dayOfWeek = idx % 7;
          return (
            <div
              key={idx}
              className={`min-h-[120px] border-b border-r border-zinc-200 p-1 ${
                day ? "bg-white" : "bg-zinc-50"
              } ${isToday(day!) ? "ring-2 ring-inset ring-blue-500" : ""}`}
            >
              {day && (
                <>
                  <div
                    className={`text-sm font-medium mb-1 ${
                      dayOfWeek === 0
                        ? "text-red-500"
                        : dayOfWeek === 6
                          ? "text-blue-500"
                          : "text-zinc-700"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayProducts.slice(0, 3).map((product) => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate block ${CATEGORY_COLORS[product.category]} hover:opacity-80 transition`}
                      >
                        {EVENT_TYPE_LABELS[product.eventType]} {product.name}
                      </button>
                    ))}
                    {dayProducts.length > 3 && (
                      <div className="text-[10px] text-zinc-400 px-1">
                        +{dayProducts.length - 3}件
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Category legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span
              className={`inline-block w-3 h-3 rounded ${CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS]}`}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs text-white ${CATEGORY_COLORS[selectedProduct.category]}`}
                >
                  {CATEGORY_LABELS[selectedProduct.category]}
                </span>
                <span className="inline-block ml-2 px-2 py-0.5 rounded text-xs bg-zinc-200 text-zinc-700">
                  {EVENT_TYPE_LABELS[selectedProduct.eventType]}
                </span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <h3 className="text-lg font-bold text-zinc-900 mb-4">
              {selectedProduct.name}
            </h3>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">定価</dt>
                <dd className="font-medium text-zinc-900">
                  ¥{selectedProduct.price.toLocaleString()}
                </dd>
              </div>
              {selectedProduct.marketPrice && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">市場相場</dt>
                  <dd className="font-medium text-red-600">
                    ¥{selectedProduct.marketPrice.toLocaleString()}
                  </dd>
                </div>
              )}
              {selectedProduct.premiumRate && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">プレミア率</dt>
                  <dd className="font-bold text-red-600">
                    {selectedProduct.premiumRate}倍
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">日程</dt>
                <dd className="text-zinc-900">
                  {selectedProduct.eventDate}
                  {selectedProduct.eventEndDate &&
                    ` ～ ${selectedProduct.eventEndDate}`}
                </dd>
              </div>
              {selectedProduct.source && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">ソース</dt>
                  <dd className="text-zinc-900">{selectedProduct.source}</dd>
                </div>
              )}
            </dl>

            {selectedProduct.note && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                ⚠ {selectedProduct.note}
              </div>
            )}

            {selectedProduct.marketPrice && selectedProduct.price && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                想定利益: ¥
                {(
                  selectedProduct.marketPrice - selectedProduct.price
                ).toLocaleString()}
                （{formatPrice(selectedProduct.price)} →{" "}
                {formatPrice(selectedProduct.marketPrice)}）
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
