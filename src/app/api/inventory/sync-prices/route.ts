export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ShopifyVariant { sku?: string; price: string; }
interface ShopifyRaw { variants?: ShopifyVariant[]; }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rename = body.rename === true;

  const [inventoryItems, shopifyProducts] = await Promise.all([
    db.inventoryItem.findMany({ select: { id: true, name: true, sku: true } }),
    db.shopifyProductCache.findMany({ select: { id: true, title: true, priceMin: true, rawJson: true } }),
  ]);

  // Build SKU → {title, price} map from all Shopify variant SKUs
  const skuMap = new Map<string, { title: string; price: number }>();
  for (const p of shopifyProducts) {
    for (const v of (p.rawJson as ShopifyRaw | null)?.variants ?? []) {
      if (v.sku?.trim()) {
        skuMap.set(v.sku.trim().toLowerCase(), { title: p.title, price: parseFloat(v.price) });
      }
    }
  }

  let skuMatches = 0, nameMatches = 0, unmatched = 0;

  await Promise.all(inventoryItems.map(async (item) => {
    // 1. Match by SKU
    if (item.sku) {
      const hit = skuMap.get(item.sku.trim().toLowerCase());
      if (hit) {
        await db.inventoryItem.update({
          where: { id: item.id },
          data: { priceEGP: hit.price, ...(rename ? { name: hit.title } : {}) },
        });
        skuMatches++;
        return;
      }
    }
    // 2. Match by name
    const norm = item.name.toLowerCase().trim();
    const match = shopifyProducts.find((p) => {
      const t = p.title.toLowerCase().trim();
      return t === norm || t.includes(norm) || norm.includes(t);
    });
    if (match) {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { priceEGP: match.priceMin, ...(rename ? { name: match.title } : {}) },
      });
      nameMatches++;
    } else {
      unmatched++;
    }
  }));

  return NextResponse.json({
    ok: true,
    total: inventoryItems.length,
    matched: skuMatches + nameMatches,
    skuMatches,
    nameMatches,
    unmatched,
  });
}
