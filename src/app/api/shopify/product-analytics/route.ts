export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProductRawAnalytics, type AnalyticsRange } from "@/lib/shopify/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") ?? "all") as AnalyticsRange;

  try {
    const [{ orderCounts, viewsByHandle }, products] = await Promise.all([
      getProductRawAnalytics(range),
      db.shopifyProductCache.findMany({ select: { id: true, title: true, handle: true } }),
    ]);

    const analytics: Record<string, { orders: number; views: number }> = {};
    for (const p of products) {
      analytics[p.id] = {
        orders: orderCounts.get(p.title) ?? 0,
        views: viewsByHandle.get(p.handle) ?? 0,
      };
    }

    return NextResponse.json({ analytics });
  } catch (err) {
    return NextResponse.json({ error: String(err), analytics: {} }, { status: 500 });
  }
}
