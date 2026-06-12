export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { items } = await req.json() as { items: { title: string; quantity: number; variantTitle?: string }[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ results: [] });

  const allInventory = await db.inventoryItem.findMany({
    select: { name: true, status: true, quantity: true, sku: true, size: true },
  });

  // Build a regex that matches a size token not surrounded by other digits/dots
  // e.g. sizeToken("8") matches "8", "Size 8", "Marquise Ring 8" but NOT "18" or "8.5"
  const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sizeToken = (sz: string) => new RegExp(`(?<![0-9.])${escRe(sz)}(?![0-9.])`, "i");

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
      const pat = sizeToken(sizeNeedle!);
      const sizeMatches = titleMatches.filter((inv) =>
        // 1. size token anywhere in the inventory item name (e.g. "Marquise Ring 8")
        pat.test(inv.name) ||
        // 2. dedicated size field — exact or word-boundary (handles "Size 8", "8", "8 EU", etc.)
        (inv.size != null && (inv.size.trim() === sizeNeedle! || pat.test(inv.size))) ||
        // 3. SKU — last numeric segment after "-" OR anywhere in the SKU string
        (inv.sku != null && (
          (inv.sku.split("-").pop()?.match(/^\d+$/) ?? [""])[0] === sizeNeedle! ||
          pat.test(inv.sku)
        ))
      );
      if (sizeMatches.length > 0) {
        matches = sizeMatches;
        sizeMatched = true;
      }
      // sizeMatched stays false — title matched but no size-specific match found
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
