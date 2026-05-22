const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2024-04";

const BASE_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}`;

async function shopifyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Shopify Admin API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getProducts(limit = 50, pageInfo?: string) {
  const params = new URLSearchParams({ limit: String(limit), fields: "id,title,handle,status,variants,images,tags,product_type,vendor" });
  if (pageInfo) params.set("page_info", pageInfo);
  return shopifyFetch<{ products: ShopifyProduct[] }>(`/products.json?${params}`);
}

export async function getOrders(limit = 50, status = "any") {
  const params = new URLSearchParams({ limit: String(limit), status });
  return shopifyFetch<{ orders: ShopifyOrder[] }>(`/orders.json?${params}`);
}

export async function getInventoryLevels(locationId: string) {
  return shopifyFetch<{ inventory_levels: InventoryLevel[] }>(
    `/inventory_levels.json?location_ids=${locationId}&limit=250`
  );
}

export async function setInventoryLevel(inventoryItemId: string, locationId: string, available: number) {
  return shopifyFetch(`/inventory_levels/set.json`, {
    method: "POST",
    body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available }),
  });
}

export async function getLocations() {
  return shopifyFetch<{ locations: { id: string; name: string }[] }>(`/locations.json`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  status: string;
  body_html: string;
  tags: string;
  product_type: string;
  vendor: string;
  variants: ShopifyVariant[];
  images: { src: string; alt: string | null }[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  inventory_item_id: number;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  phone: string | null;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_items: { title: string; quantity: number; price: string }[];
  customer: { first_name: string; last_name: string; email: string } | null;
}

export interface InventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}
