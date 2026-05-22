import { db } from "@/lib/db";
import { getProducts } from "@/lib/shopify/admin";

let cache: { data: string; expiresAt: number } | null = null;

export async function getProductContextString(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const products = await db.shopifyProductCache.findMany({
    where: { available: true },
    orderBy: { syncedAt: "desc" },
    take: 60,
  });

  if (products.length === 0) {
    const text = "No products currently in catalog.";
    cache = { data: text, expiresAt: Date.now() + 5 * 60 * 1000 };
    return text;
  }

  const lines = products.map((p) => {
    const price =
      p.priceMin === p.priceMax
        ? `${p.priceMin} ${p.currency}`
        : `${p.priceMin}–${p.priceMax} ${p.currency}`;
    return `• ${p.title} | ${price} | ${p.available ? "In stock" : "Out of stock"} | Tags: ${p.tags.join(", ")}`;
  });

  const text = `=== PRODUCT CATALOG ===\n${lines.join("\n")}`;
  cache = { data: text, expiresAt: Date.now() + 5 * 60 * 1000 };
  return text;
}

export async function syncProductsToCache() {
  const { products } = await getProducts(250);
  for (const p of products) {
    const priceMin = Math.min(...p.variants.map((v) => parseFloat(v.price)));
    const priceMax = Math.max(...p.variants.map((v) => parseFloat(v.price)));
    const available = p.variants.some((v) => v.inventory_quantity > 0);
    await db.shopifyProductCache.upsert({
      where: { id: String(p.id) },
      update: {
        handle: p.handle,
        title: p.title,
        description: p.body_html?.replace(/<[^>]+>/g, "").slice(0, 500) ?? "",
        priceMin,
        priceMax,
        currency: "EGP",
        imageUrl: p.images[0]?.src ?? null,
        tags: p.tags.split(", ").filter(Boolean),
        available,
        rawJson: JSON.parse(JSON.stringify(p)),
        syncedAt: new Date(),
      },
      create: {
        id: String(p.id),
        handle: p.handle,
        title: p.title,
        description: p.body_html?.replace(/<[^>]+>/g, "").slice(0, 500) ?? "",
        priceMin,
        priceMax,
        currency: "EGP",
        imageUrl: p.images[0]?.src ?? null,
        tags: p.tags.split(", ").filter(Boolean),
        available,
        rawJson: JSON.parse(JSON.stringify(p)),
      },
    });
  }
  cache = null; // invalidate in-memory cache
}
