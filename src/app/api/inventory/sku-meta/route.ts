export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAT_PREFIX: Record<string, string> = {
  Ring: "R", Earrings: "E", Necklace: "N", Bracelet: "B",
  Set: "S", Anklet: "A", Other: "O",
};

type RawVariant = { title?: string; sku?: string; price?: string; inventory_quantity?: number };

export async function GET() {
  const [items, shopifyRows] = await Promise.all([
    db.inventoryItem.findMany({
      select: { id: true, name: true, sku: true, category: true, priceEGP: true },
      orderBy: { name: "asc" },
    }),
    db.shopifyProductCache.findMany({
      select: { id: true, title: true, imageUrl: true, rawJson: true },
      orderBy: { title: "asc" },
    }),
  ]);

  // Unique products per category (dedup by name) — used by new-color / new modes
  const byCategory: Record<string, Array<{ id: string; name: string; sku: string | null; priceEGP: number | null }>> = {};
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.category}::${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push({ id: item.id, name: item.name, sku: item.sku, priceEGP: item.priceEGP });
  }

  // Next sequential SKU number per prefix
  const nextNumbers: Record<string, number> = {};
  for (const [cat, prefix] of Object.entries(CAT_PREFIX)) {
    let max = 0;
    for (const item of items) {
      if (item.category !== cat || !item.sku?.startsWith(prefix)) continue;
      const num = parseInt(item.sku.slice(prefix.length, prefix.length + 5), 10);
      if (!isNaN(num) && num > max) max = num;
    }
    nextNumbers[prefix] = max + 1;
  }

  // Shopify products with their real variants — used by existing mode
  const shopifyProducts = shopifyRows.map((p) => {
    const raw = p.rawJson as { variants?: RawVariant[] } | null;
    const allVariants = raw?.variants ?? [];
    const firstVariant = allVariants[0];
    const variants = allVariants
      .map((v) => ({
        title: v.title ?? "",
        sku: v.sku ?? "",
        price: parseFloat(v.price ?? "0"),
        qty: v.inventory_quantity ?? 0,
      }))
      .filter((v) => v.title && v.title !== "Default Title");
    return {
      id: p.id, title: p.title, imageUrl: p.imageUrl, variants,
      defaultSku: firstVariant?.sku ?? "",
      defaultPrice: parseFloat(firstVariant?.price ?? "0") || p.priceMin,
    };
  });

  return NextResponse.json({ byCategory, nextNumbers, shopifyProducts });
}
