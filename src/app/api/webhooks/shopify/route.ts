export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyShopifyHmac } from "@/lib/shopify/webhook-verify";
import { syncProductsToCache } from "@/lib/ai/product-context";
import { sendPushToAll } from "@/lib/push";

interface ShopifyFulfillment {
  status: string;
  shipment_status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
}

interface ShopifyOrderPayload {
  id: number;
  order_number: number;
  email?: string;
  phone?: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_items: unknown[];
  fulfillments?: ShopifyFulfillment[];
}

function extractFulfillmentData(order: ShopifyOrderPayload) {
  const lastFulfillment = order.fulfillments?.[order.fulfillments.length - 1] ?? null;
  return {
    fulfillmentStatus: order.fulfillment_status ?? null,
    shipmentStatus: lastFulfillment?.shipment_status ?? null,
    trackingNumber: lastFulfillment?.tracking_number ?? null,
    trackingUrl: lastFulfillment?.tracking_url ?? null,
  };
}

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

  if (
    topic === "orders/create" ||
    topic === "orders/updated" ||
    topic === "orders/fulfilled" ||
    topic === "fulfillments/create" ||
    topic === "fulfillments/update"
  ) {
    const order = (topic.startsWith("fulfillments/")
      ? (payload as { order_id: number } & ShopifyOrderPayload)
      : payload) as ShopifyOrderPayload;

    const fulfillment = extractFulfillmentData(order);

    await db.shopifyOrderCache.upsert({
      where: { id: String(order.id) },
      update: {
        status: order.financial_status,
        ...fulfillment,
        lineItemsJson: JSON.parse(JSON.stringify(order.line_items ?? [])),
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
        ...fulfillment,
        lineItemsJson: JSON.parse(JSON.stringify(order.line_items ?? [])),
        createdAt: new Date(order.created_at),
      },
    });

    // Auto-mark inventory items as SOLD when order is fulfilled AND paid
    const isPaid = order.financial_status === "paid";
    const isFulfilled = order.fulfillment_status === "fulfilled";
    if (isPaid && isFulfilled && order.order_number) {
      const orderNoStr = String(order.order_number);
      await db.inventoryItem.updateMany({
        where: { orderNo: orderNoStr, status: { not: "SOLD" } },
        data: { status: "SOLD" },
      });
    }

    // On new order: check inventory for each item and send push notification
    if (topic === "orders/create") {
      checkInventoryAndNotify(order).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true });
}

async function checkInventoryAndNotify(order: ShopifyOrderPayload) {
  const lineItems = order.line_items as { title: string; quantity: number; sku?: string }[];
  if (!lineItems?.length) return;

  const inventoryItems = await db.inventoryItem.findMany({
    where: { status: "IN_STOCK" },
  });

  const results: string[] = [];

  for (const item of lineItems) {
    const title = item.title.toLowerCase();
    const qty = item.quantity;

    // Match by SKU first, then by name similarity
    const match = inventoryItems.find((inv) =>
      (item.sku && inv.sku && inv.sku.toLowerCase() === item.sku.toLowerCase()) ||
      inv.name.toLowerCase().includes(title) ||
      title.includes(inv.name.toLowerCase())
    );

    if (match) {
      results.push(`✅ ${item.title} (×${qty}) — in stock (${match.name})`);
    } else {
      results.push(`🔴 ${item.title} (×${qty}) — NOT in inventory, needs manufacturing`);
    }
  }

  const orderNum = order.order_number;
  const title = `New Order #${orderNum}`;
  const body = results.join("\n");

  await sendPushToAll(title, body, "/orders");
  console.log(`[Shopify] Order #${orderNum} inventory check:\n${body}`);
}

