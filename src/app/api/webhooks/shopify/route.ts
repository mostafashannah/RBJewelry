export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyShopifyHmac } from "@/lib/shopify/webhook-verify";
import { syncProductsToCache } from "@/lib/ai/product-context";

export async function POST(req: NextRequest) {
  const ab = await req.arrayBuffer();
  const rawBody = Buffer.from(ab);
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  if (!verifyShopifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf-8"));

  await db.webhookEvent.create({
    data: { source: "SHOPIFY", eventType: topic, payload, processed: false },
  });

  if (topic.startsWith("products/")) {
    syncProductsToCache().catch(console.error);
  }

  if (topic === "orders/create" || topic === "orders/updated") {
    const order = payload as {
      id: number;
      order_number: number;
      email?: string;
      phone?: string;
      total_price: string;
      currency: string;
      financial_status: string;
      created_at: string;
      line_items: unknown[];
    };

    await db.shopifyOrderCache.upsert({
      where: { id: String(order.id) },
      update: {
        status: order.financial_status,
        lineItemsJson: JSON.parse(JSON.stringify(order.line_items)),
        syncedAt: new Date(),
      },
      create: {
        id: String(order.id),
        orderNumber: String(order.order_number),
        customerEmail: order.email ?? null,
        customerPhone: order.phone ?? null,
        totalPrice: parseFloat(order.total_price),
        currency: order.currency,
        status: order.financial_status,
        lineItemsJson: JSON.parse(JSON.stringify(order.line_items)),
        createdAt: new Date(order.created_at),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
