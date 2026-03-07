import { supabase } from "./supabase";
import { Product } from "@/types/product";

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
}

function toProduct(row: DBProduct): Product {
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

  return (data as DBProduct[]).map(toProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toProduct(data as DBProduct);
}

export function generateSlug(product: Product): string {
  return `${product.id}`;
}
