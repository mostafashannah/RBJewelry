export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { items } = await req.json() as { items: { title: string; quantity: number; variantTitle?: string }[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ results: [] });

  const allInventory = await db.inventoryItem.findMany({
    select: { name: true, status: true, quantity: true, sku: true, size: true },
  });

  const skuLastSegment = (sku: string | null): string | null => {
    if (!sku) return null;
    const parts = sku.split("-");
    const last = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
  };

  const results = items.map(({ title, quantity, variantTitle }) => {
    const needle = title.toLowerCase().trim();
    const sizeNeedle = variantTitle?.toLowerCase().trim();
    const hasSize = sizeNeedle && sizeNeedle !== "default title";

    // Match by title
    const titleMatches = allInventory.filter((inv) => {
      const hay = inv.name.toLowerCase().trim();
      return hay.includes(needle) || needle.includes(hay);
    });

    // Narrow by size if available and matches exist
    let matches = titleMatches;
    let sizeMatched = !hasSize; // true when no size needed
    if (hasSize && titleMatches.length > 0) {
      const sizeMatches = titleMatches.filter((inv) =>
        inv.name.toLowerCase().includes(sizeNeedle!) ||
        (inv.size?.toLowerCase().trim() === sizeNeedle) ||
        skuLastSegment(inv.sku) === sizeNeedle
      );
      if (sizeMatches.length > 0) {
        matches = sizeMatches;
        sizeMatched = true;
      }
      // sizeMatched stays false — we have title matches but none for this specific size
    }

    const inStock = matches.filter((m) => m.status === "IN_STOCK").reduce((s, m) => s + m.quantity, 0);
    const reserved = matches.filter((m) => m.status === "RESERVED").length;
    const sold = matches.filter((m) => m.status === "SOLD").length;

    return {
      title,
      variantTitle: variantTitle ?? null,
      quantity,
      found: matches.length > 0,
      sizeMatched,
      inStock,
      reserved,
      sold,
    };
  });

  return NextResponse.json({ results });
}
