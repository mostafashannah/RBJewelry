export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type RawItem = { title: string; quantity?: number; variantTitle?: string; sku?: string };

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("orderNo")?.replace(/^#/, "").trim();
  if (!raw) return NextResponse.json({ error: "orderNo required" }, { status: 400 });

  const order = await db.shopifyOrderCache.findFirst({
    where: { orderNumber: raw },
    select: { orderNumber: true, lineItemsJson: true, createdAt: true },
  });

  if (!order) return NextResponse.json({ error: `Order #${raw} not found` }, { status: 404 });

  const json = order.lineItemsJson as { items?: RawItem[] } | null;
  const items = (json?.items ?? []).map((li) => ({
    title: li.title,
    sku: li.sku ?? null,
    quantity: li.quantity ?? 1,
    variantTitle: li.variantTitle ?? null,
  }));

  return NextResponse.json({ orderNo: order.orderNumber, createdAt: order.createdAt, items });
}
