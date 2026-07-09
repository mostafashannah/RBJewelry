export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Range = "all" | "today" | "yesterday" | "week" | "month";

function getDateFilter(range: Range): { gte?: Date; lt?: Date } | undefined {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") return { gte: todayStart };
  if (range === "yesterday") {
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    return { gte: yStart, lt: todayStart };
  }
  if (range === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 7); return { gte: d };
  }
  if (range === "month") {
    const d = new Date(now); d.setDate(d.getDate() - 30); return { gte: d };
  }
  return undefined;
}

function mainSku(sku: string): string {
  const m = sku.match(/^([A-Z]\d{5})/);
  return m ? m[1] : sku;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") ?? "all") as Range;
  const dateFilter = getDateFilter(range);

  const [soldItems, products] = await Promise.all([
    db.inventoryItem.findMany({
      where: {
        status: "SOLD",
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { sku: true, quantity: true },
    }),
    db.shopifyProductCache.findMany({
      select: { id: true, rawJson: true },
    }),
  ]);

  // Count sold units by main SKU
  const soldByMainSku = new Map<string, number>();
  for (const item of soldItems) {
    if (!item.sku) continue;
    const key = mainSku(item.sku);
    soldByMainSku.set(key, (soldByMainSku.get(key) ?? 0) + (item.quantity ?? 1));
  }

  // Map product ID → sold count via variant SKUs in rawJson
  const soldCounts: Record<string, number> = {};
  for (const product of products) {
    const variants = (product.rawJson as { variants?: { sku?: string }[] } | null)?.variants ?? [];
    const seenMainSkus = new Set<string>();
    let count = 0;
    for (const v of variants) {
      if (!v.sku) continue;
      const key = mainSku(v.sku);
      if (!seenMainSkus.has(key)) {
        seenMainSkus.add(key);
        count += soldByMainSku.get(key) ?? 0;
      }
    }
    soldCounts[product.id] = count;
  }

  return NextResponse.json({ soldCounts });
}
