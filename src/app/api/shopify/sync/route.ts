export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { syncProductsToCache } from "@/lib/ai/product-context";
import { syncOrdersToCache } from "@/lib/shopify/admin";
import { releaseFromCancelledOrders } from "@/lib/inventory/release-cancelled";

export async function POST() {
  try {
    const [, orderCount] = await Promise.all([syncProductsToCache(), syncOrdersToCache()]);
    await releaseFromCancelledOrders();
    return NextResponse.json({ ok: true, message: `Synced ${orderCount} orders and all products` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
