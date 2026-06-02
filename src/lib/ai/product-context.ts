import { db } from "@/lib/db";
import { getProducts, ShopifyProduct, ShopifyVariant } from "@/lib/shopify/admin";

let cache: { data: string; expiresAt: number } | null = null;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatVariants(variants: ShopifyVariant[]): string {
  if (!variants?.length) return "";
  const unique = Array.from(new Set(variants.map((v) => v.title).filter((t) => t !== "Default Title")));
  if (unique.length === 0) return "";
  return `Sizes/Options: ${unique.join(", ")}`;
}

function buildProductBlock(p: {
  title: string;
  description: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  available: boolean;
  tags: string[];
  rawJson: unknown;
}): string {
  const raw = p.rawJson as ShopifyProduct | null;

  // Detect sale: compare_at_price > price on any variant
  const variants = raw?.variants ?? [];
  const compareAtMin = variants
    .map((v) => parseFloat(v.compare_at_price ?? "0"))
    .filter((n) => n > 0);
  const originalMin = compareAtMin.length > 0 ? Math.min(...compareAtMin) : null;
  const onSale = originalMin !== null && originalMin > p.priceMin;

  const salePrice =
    p.priceMin === p.priceMax
      ? `${p.priceMin} ${p.currency}`
      : `${p.priceMin}–${p.priceMax} ${p.currency}`;

  const price = onSale
    ? `was ${originalMin} ${p.currency}, now ${salePrice} 🔖`
    : salePrice;

  const lines: string[] = [`• ${p.title} — ${price} — ${p.available ? "In stock" : "Out of stock"}`];

  const variantLine = raw?.variants ? formatVariants(raw.variants) : "";
  if (variantLine) lines.push(`  ${variantLine}`);

  if (p.description) {
    const desc = p.description.slice(0, 300);
    lines.push(`  Details: ${desc}`);
  }

  if (p.tags.length) {
    lines.push(`  Tags: ${p.tags.join(", ")}`);
  }

  return lines.join("\n");
}

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

  const blocks = products.map(buildProductBlock);
  const text = `=== PRODUCT CATALOG (${products.length} items) ===\n${blocks.join("\n\n")}`;
  cache = { data: text, expiresAt: Date.now() + 5 * 60 * 1000 };
  return text;
}

export async function syncProductsToCache() {
  const { products } = await getProducts(250);
  for (const p of products) {
    const priceMin = Math.min(...p.variants.map((v) => parseFloat(v.price)));
    const priceMax = Math.max(...p.variants.map((v) => parseFloat(v.price)));
    const available = p.variants.some((v) => v.inventory_quantity > 0);
    const description = p.body_html ? stripHtml(p.body_html).slice(0, 800) : "";

    await db.shopifyProductCache.upsert({
      where: { id: String(p.id) },
      update: {
        handle: p.handle,
        title: p.title,
        description,
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
        description,
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
  cache = null;
}
