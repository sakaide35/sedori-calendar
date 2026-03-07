import ProductFeed from "@/components/ProductFeed";
import { getProducts } from "@/lib/products";

export const revalidate = 60;

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-black text-zinc-900">
            せどりカレンダー
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            転売商材の発売日・抽選日を日付順にチェック
          </p>
        </div>
      </header>

      <main className="px-4 py-6">
        <ProductFeed products={products} />
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-8">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-zinc-400">
          ※ 掲載情報は各公式サイト・SNS等を元にしています。正確性を保証するものではありません。
          <br />
          ※ 酒類の転売には酒類販売業免許が必要です。
        </div>
      </footer>
    </div>
  );
}
