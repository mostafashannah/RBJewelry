import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const db = new PrismaClient();

async function main() {
  const version = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2024-10";

  // Use DB-stored OAuth token and shop domain
  const config = await db.shopifyConfig.findFirst();
  const token = config?.accessToken ?? process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
  const domain = config?.shop ?? process.env.SHOPIFY_STORE_DOMAIN!;

  if (!token) { console.error("No Shopify token found"); return; }
  console.log(`Using token from ${config ? "DB (OAuth)" : "env var"}, shop=${domain}`);

  const query = `{
    orders(first: 100, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email phone createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        financialStatus fulfillmentStatus
        lineItems(first: 5) { edges { node { title quantity } } }
        customer { firstName lastName }
        shippingAddress { phone }
      }}
    }
  }`;

  const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json() as { data?: { orders?: { edges?: { node: Record<string, unknown> }[] } }; errors?: unknown[] };

  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    return;
  }

  const orders = json.data?.orders?.edges ?? [];
  console.log(`Got ${orders.length} orders from Shopify`);
  if (orders.length === 0) return;

  let upserted = 0;
  for (const { node: o } of orders) {
    const priceSet = o.totalPriceSet as { shopMoney: { amount: string; currencyCode: string } };
    const items = (o.lineItems as { edges: { node: { title: string; quantity: number } }[] }).edges;
    const customer = o.customer as { firstName?: string; lastName?: string } | null;
    const shipping = o.shippingAddress as { phone?: string } | null;
    const customerName = customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() : null;
    const payment = (o.financialStatus as string) ?? "";
    const fulfillment = (o.fulfillmentStatus as string) ?? null;

    await db.shopifyOrderCache.upsert({
      where: { id: o.id as string },
      update: {
        status: `${payment} / ${fulfillment ?? "UNFULFILLED"}`,
        totalPrice: parseFloat(priceSet.shopMoney.amount),
        fulfillmentStatus: fulfillment,
        syncedAt: new Date(),
        lineItemsJson: { customerName, count: items.length, items: items.map((e) => ({ title: e.node.title, quantity: e.node.quantity })) },
      },
      create: {
        id: o.id as string,
        orderNumber: (o.name as string).replace("#", ""),
        customerEmail: o.email as string | null,
        customerPhone: (o.phone as string | null) ?? shipping?.phone ?? null,
        totalPrice: parseFloat(priceSet.shopMoney.amount),
        currency: priceSet.shopMoney.currencyCode,
        status: `${payment} / ${fulfillment ?? "UNFULFILLED"}`,
        fulfillmentStatus: fulfillment,
        lineItemsJson: { customerName, count: items.length, items: items.map((e) => ({ title: e.node.title, quantity: e.node.quantity })) },
        createdAt: new Date(o.createdAt as string),
      },
    });
    upserted++;
  }

  console.log(`✅ Synced ${upserted} orders`);
  const all = await db.shopifyOrderCache.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log("Latest 5:");
  for (const o of all) {
    const meta = o.lineItemsJson as { customerName?: string };
    console.log(`  #${o.orderNumber} | ${meta?.customerName ?? o.customerEmail ?? "—"} | ${o.totalPrice} ${o.currency} | ${o.status}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
