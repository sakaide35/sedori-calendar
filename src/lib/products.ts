import { supabase } from "./supabase";
import { Product, SalesChannel } from "@/types/product";

interface DBProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  market_price: number | null;
  premium_rate: number | null;
  event_date: string;
  event_end_date: string | null;
  event_type: string;
  source: string | null;
  note: string | null;
  estimated_resale_price: number | null;
  snkrdunk_url: string | null;
  official_url: string | null;
}

interface DBSalesChannel {
  id: string;
  product_id: string;
  channel_type: string;
  name: string;
  url: string | null;
  store_detail: string | null;
}

function toSalesChannel(row: DBSalesChannel): SalesChannel {
  return {
    id: row.id,
    channelType: row.channel_type as SalesChannel["channelType"],
    name: row.name,
    url: row.url ?? undefined,
    storeDetail: row.store_detail ?? undefined,
  };
}

function toProduct(row: DBProduct, channels?: DBSalesChannel[]): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Product["category"],
    price: row.price,
    marketPrice: row.market_price ?? undefined,
    premiumRate: row.premium_rate ?? undefined,
    eventDate: row.event_date,
    eventEndDate: row.event_end_date ?? undefined,
    eventType: row.event_type as Product["eventType"],
    source: row.source ?? undefined,
    note: row.note ?? undefined,
    estimatedResalePrice: row.estimated_resale_price ?? undefined,
    snkrdunkUrl: row.snkrdunk_url ?? undefined,
    officialUrl: row.official_url ?? undefined,
    salesChannels: channels?.map(toSalesChannel),
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }

  const productIds = (data as DBProduct[]).map((p) => p.id);
  const { data: channels } = await supabase
    .from("sales_channels")
    .select("*")
    .in("product_id", productIds);

  const channelsByProduct = (channels as DBSalesChannel[] | null)?.reduce<Record<string, DBSalesChannel[]>>((acc, ch) => {
    if (!acc[ch.product_id]) acc[ch.product_id] = [];
    acc[ch.product_id].push(ch);
    return acc;
  }, {}) ?? {};

  return (data as DBProduct[]).map((row) => toProduct(row, channelsByProduct[row.id]));
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const { data: channels } = await supabase
    .from("sales_channels")
    .select("*")
    .eq("product_id", id);

  return toProduct(data as DBProduct, (channels as DBSalesChannel[] | null) ?? undefined);
}

export function generateSlug(product: Product): string {
  return `${product.id}`;
}
