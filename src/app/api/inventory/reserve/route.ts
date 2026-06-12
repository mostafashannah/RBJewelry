export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sizeToken = (sz: string) => new RegExp(`(?<![0-9.])${escRe(sz)}(?![0-9.])`, "i");

export async function POST(req: NextRequest) {
  const { title, variantTitle, orderNumber, sku } = await req.json() as {
    title: string; variantTitle?: string; orderNumber: string; sku?: string;
  };

  if (!title || !orderNumber) {
    return NextResponse.json({ error: "title and orderNumber required" }, { status: 400 });
  }

  const allInventory = await db.inventoryItem.findMany({
    where: { status: "IN_STOCK" },
    select: { id: true, name: true, size: true, sku: true },
  });

  // SKU-first: most reliable match
  if (sku?.trim()) {
    const orderSku = sku.trim().toLowerCase();
    const skuMatches = allInventory.filter(
      (inv) => inv.sku != null && inv.sku.trim().toLowerCase() === orderSku
    );
    if (skuMatches.length > 0) {
      const item = skuMatches[0];
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { status: "RESERVED", orderNo: orderNumber },
      });
      return NextResponse.json({ ok: true, reservedId: item.id, reservedName: item.name });
    }
  }

  const needle = title.toLowerCase().trim();
  const sizeNeedle = variantTitle?.toLowerCase().trim();
  const hasSize = sizeNeedle && sizeNeedle !== "default title";

  const titleMatches = allInventory.filter((inv) => {
    const hay = inv.name.toLowerCase().trim();
    return hay.includes(needle) || needle.includes(hay);
  });

  let matches = titleMatches;
  if (hasSize && titleMatches.length > 0) {
    const pat = sizeToken(sizeNeedle!);
    const sizeMatches = titleMatches.filter((inv) =>
      pat.test(inv.name) ||
      (inv.size != null && (inv.size.trim() === sizeNeedle! || pat.test(inv.size))) ||
      (inv.sku != null && (
        (inv.sku.split("-").pop()?.match(/^\d+$/) ?? [""])[0] === sizeNeedle! ||
        pat.test(inv.sku)
      ))
    );
    if (sizeMatches.length > 0) matches = sizeMatches;
    else {
      const anyTracksSize = titleMatches.some((inv) =>
        inv.size != null ||
        /(?<![0-9.])\d+(?![0-9.])/.test(inv.name) ||
        (inv.sku != null && inv.sku.split("-").pop()?.match(/^\d+$/))
      );
      if (!anyTracksSize) matches = titleMatches;
      else matches = [];
    }
  }

  if (matches.length === 0) {
    return NextResponse.json({ error: "No matching in-stock item found" }, { status: 404 });
  }

  const item = matches[0];
  await db.inventoryItem.update({
    where: { id: item.id },
    data: { status: "RESERVED", orderNo: orderNumber },
  });

  return NextResponse.json({ ok: true, reservedId: item.id, reservedName: item.name });
}
