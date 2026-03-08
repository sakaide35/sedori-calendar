import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/lib/products";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  EVENT_TYPE_LABELS,
} from "@/types/product";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "商品が見つかりません" };

  const title = `${product.name} ${EVENT_TYPE_LABELS[product.eventType]}情報 | せどりカレンダー`;
  const description = `${product.name}の${EVENT_TYPE_LABELS[product.eventType]}情報。定価${product.price.toLocaleString()}円${product.marketPrice ? `、市場相場${product.marketPrice.toLocaleString()}円（${product.premiumRate}倍）` : ""}。${product.eventDate}${product.eventEndDate ? `〜${product.eventEndDate}` : ""}。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[d.getDay()];
  return `${year}年${month}月${day}日（${weekday}）`;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const profit = product.marketPrice
    ? product.marketPrice - product.price
    : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ← トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <article>
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs text-white font-bold ${CATEGORY_COLORS[product.category]}`}
            >
              {CATEGORY_LABELS[product.category]}
            </span>
            <span className="inline-block px-3 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700 font-bold">
              {EVENT_TYPE_LABELS[product.eventType]}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-zinc-900 leading-tight mb-6">
            {product.name}
          </h1>

          {/* Date */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-sm font-bold text-zinc-500 mb-2">
              {EVENT_TYPE_LABELS[product.eventType]}日程
            </h2>
            <p className="text-xl font-bold text-zinc-900">
              {formatDate(product.eventDate)}
              {product.eventEndDate && (
                <span className="text-zinc-400">
                  {" "}〜 {formatDate(product.eventEndDate)}
                </span>
              )}
            </p>
          </div>

          {/* Price info */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-sm font-bold text-zinc-500 mb-3">価格情報</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400">定価</p>
                <p className="text-xl font-bold text-zinc-900">
                  {formatPrice(product.price)}
                </p>
              </div>
              {product.marketPrice && (
                <div>
                  <p className="text-xs text-zinc-400">市場相場</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatPrice(product.marketPrice)}
                  </p>
                </div>
              )}
            </div>

            {product.premiumRate && profit !== null && (
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">プレミア率</p>
                  <p className={`text-3xl font-black ${
                    product.premiumRate >= 3
                      ? "text-red-600"
                      : product.premiumRate >= 1.5
                        ? "text-orange-500"
                        : "text-green-600"
                  }`}>
                    {product.premiumRate}倍
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">想定利益</p>
                  <p className="text-2xl font-black text-green-600">
                    +{formatPrice(profit)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          {product.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <h2 className="text-sm font-bold text-amber-800 mb-1">注意事項</h2>
              <p className="text-amber-800">{product.note}</p>
            </div>
          )}

          {/* SEO structured data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.name,
                category: CATEGORY_LABELS[product.category],
                offers: {
                  "@type": "Offer",
                  price: product.price,
                  priceCurrency: "JPY",
                  availability: "https://schema.org/LimitedAvailability",
                },
              }),
            }}
          />
        </article>
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-8">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-zinc-400">
          ※ 掲載情報は各公式サイト・SNS等を元にしています。正確性を保証するものではありません。
        </div>
      </footer>
    </div>
  );
}
