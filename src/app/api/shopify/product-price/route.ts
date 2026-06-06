export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ShopifyVariant {
  sku?: string;
  price: string;
  title: string;
}

interface ShopifyRaw {
  variants?: ShopifyVariant[];
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const sku = req.nextUrl.searchParams.get("sku") ?? "";

  if (!name && !sku) return NextResponse.json({ products: [] });

  // Name search
  if (name) {
    const products = await db.shopifyProductCache.findMany({
      where: { title: { contains: name, mode: "insensitive" } },
      select: { id: true, title: true, priceMin: true, priceMax: true, imageUrl: true },
      take: 6,
    });
    return NextResponse.json({ products });
  }

  // SKU search — scan rawJson variants across all products
  const all = await db.shopifyProductCache.findMany({
    select: { id: true, title: true, priceMin: true, priceMax: true, imageUrl: true, rawJson: true },
  });
  for (const p of all) {
    const raw = p.rawJson as ShopifyRaw | null;
    const variant = (raw?.variants ?? []).find(
      (v) => v.sku && v.sku.trim().toLowerCase() === sku.trim().toLowerCase()
    );
    if (variant) {
      return NextResponse.json({
        products: [{
          id: p.id,
          title: p.title,
          priceMin: parseFloat(variant.price),
          priceMax: parseFloat(variant.price),
          imageUrl: p.imageUrl,
        }],
      });
    }
  }
  return NextResponse.json({ products: [] });
}
