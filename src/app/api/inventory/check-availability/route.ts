export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Normalize a size value to a canonical numeric string so "8", "08", "8.0", "Size 8", "US 8", "EU 8" all equal "8"
function canonicalSize(s: string): string {
  const m = s.trim().match(/\b(\d+(?:\.\d+)?)\b/);
  if (!m) return s.trim().toLowerCase();
  const n = parseFloat(m[1]);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Extract all numeric tokens from a string using exec loop (avoids matchAll iterator TS issues)
function numericTokens(s: string): string[] {
  const re = /\b\d+(?:\.\d+)?\b/g;
  const result: string[] = [];
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(s)) !== null) result.push(hit[0]);
  return result;
}

// Strip trailing numeric token from an inventory name: "Marquise Ring 8" → "marquise ring"
function baseName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+\d+(?:\.\d+)?\s*$/, "").trim();
}

export async function POST(req: NextRequest) {
  const { items } = await req.json() as { items: { title: string; quantity: number; variantTitle?: string; sku?: string }[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ results: [] });

  const allInventory = await db.inventoryItem.findMany({
    select: { name: true, status: true, quantity: true, sku: true, size: true },
  });

  const results = items.map(({ title, quantity, variantTitle, sku: itemSku }) => {
    const needle = title.toLowerCase().trim();
    const sizeNeedle = variantTitle?.toLowerCase().trim();
    const hasSize = sizeNeedle && sizeNeedle !== "default title";
    const canonicalNeedle = hasSize ? canonicalSize(sizeNeedle!) : null;
    const orderSku = itemSku?.trim().toLowerCase();

    // --- SKU-first matching ---
    // If the order line item has a SKU, match directly against inventory SKU (most reliable)
    if (orderSku) {
      const skuMatches = allInventory.filter(
        (inv) => inv.sku != null && inv.sku.trim().toLowerCase() === orderSku
      );
      if (skuMatches.length > 0) {
        const inStock = skuMatches.filter((m) => m.status === "IN_STOCK").reduce((s, m) => s + m.quantity, 0);
        const reserved = skuMatches.filter((m) => m.status === "RESERVED").length;
        const sold = skuMatches.filter((m) => m.status === "SOLD").length;
        return { title, variantTitle: variantTitle ?? null, quantity, found: true, sizeMatched: true, inStock, reserved, sold, sku: itemSku };
      }
    }

    // --- Title + size matching (fallback) ---
    // Broad title match: inventory name contains order title or vice versa
    const titleMatches = allInventory.filter((inv) => {
      const hay = inv.name.toLowerCase().trim();
      return hay.includes(needle) || needle.includes(hay);
    });

    // Close matches: inventory base name equals order title exactly
    // e.g. "Marquise Ring 8" base = "marquise ring" matches needle "marquise ring" ✓
    const closeMatches = titleMatches.filter((inv) => {
      const hay = inv.name.toLowerCase().trim();
      return hay === needle || baseName(inv.name) === needle;
    });

    // Use close matches to decide if this product type tracks sizes
    const sizeCheckItems = closeMatches.length > 0 ? closeMatches : titleMatches;
    const anyTracksSize = sizeCheckItems.some((inv) =>
      inv.size != null ||
      /\b\d+\b/.test(inv.name) ||
      (inv.sku != null && /^\d+$/.test(inv.sku.split("-").pop() ?? ""))
    );

    let matches = titleMatches;
    let sizeMatched = !hasSize;

    if (hasSize && titleMatches.length > 0 && canonicalNeedle) {
      const sizeMatches = titleMatches.filter((inv) => {
        // 1. Dedicated size field
        if (inv.size != null && canonicalSize(inv.size) === canonicalNeedle) return true;
        // 2. Numeric tokens anywhere in the inventory item name
        if (numericTokens(inv.name).some((t) => canonicalSize(t) === canonicalNeedle)) return true;
        // 3. SKU — last segment or any numeric token
        if (inv.sku) {
          const last = inv.sku.split("-").pop() ?? "";
          if (/^\d+$/.test(last) && canonicalSize(last) === canonicalNeedle) return true;
          if (numericTokens(inv.sku).some((t) => canonicalSize(t) === canonicalNeedle)) return true;
        }
        return false;
      });

      if (sizeMatches.length > 0) {
        matches = sizeMatches;
        sizeMatched = true;
      } else if (!anyTracksSize) {
        // No size info found on any close-matched item → product doesn't track sizes
        sizeMatched = true;
      }
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
      sku: itemSku,
    };
  });

  return NextResponse.json({ results });
}
