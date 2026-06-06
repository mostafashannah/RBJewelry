import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const db = new PrismaClient();

function pd(raw: string): Date {
  const c = raw.trim().replace(/-/g, "/");
  const [m, d, y] = c.split("/").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const investments = [
  { name: "Radwa",   amount: 36760, date: "4/27/2026" },
  { name: "Mostafa", amount: 1170,  date: "4/27/2026" },
  { name: "Mostafa", amount: 1306,  date: "4/28/2026" },
  { name: "Mostafa", amount: 11957, date: "4/28/2026" },
  { name: "Mostafa", amount: 10000, date: "4/30/2026" },
  { name: "Mostafa", amount: 325,   date: "4/30/2026" },
  { name: "Mostafa", amount: 280,   date: "5/3/2026"  },
  { name: "Mostafa", amount: 15000, date: "5/4/2026"  },
  { name: "Mostafa", amount: 1875,  date: "5/9/2026"  },
  { name: "Mostafa", amount: 500,   date: "5/11/2026" },
  { name: "Mostafa", amount: 5500,  date: "5/12/2026" },
  { name: "Mostafa", amount: 590,   date: "5/12/2026" },
  { name: "Mostafa", amount: 654,   date: "5/17/2026" },
  { name: "Mostafa", amount: 4600,  date: "5/18/2026" },
  { name: "Mostafa", amount: 200,   date: "5/21/2026" },
  { name: "Mostafa", amount: 2000,  date: "6/1/2026"  },
];

async function syncOrders() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN!;
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
  const version = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2024-10";

  const query = `{
    orders(first: 100, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email phone createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        displayFinancialStatus displayFulfillmentStatus
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

  const json = await res.json() as { data?: { orders?: { edges?: { node: Record<string, unknown> }[] } } };
  const orders = json.data?.orders?.edges ?? [];

  let upserted = 0;
  for (const { node: o } of orders) {
    const priceSet = o.totalPriceSet as { shopMoney: { amount: string; currencyCode: string } };
    const items = (o.lineItems as { edges: { node: { title: string; quantity: number } }[] }).edges;
    const customer = o.customer as { firstName?: string; lastName?: string } | null;
    const shipping = o.shippingAddress as { phone?: string } | null;
    const customerName = customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() : null;
    const payment = (o.displayFinancialStatus as string) ?? "";
    const fulfillment = (o.displayFulfillmentStatus as string) ?? null;

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
  return upserted;
}

async function main() {
  // Sync orders
  console.log("Syncing Shopify orders...");
  try {
    const n = await syncOrders();
    const total = await db.shopifyOrderCache.count();
    console.log(`✅ Synced ${n} orders (${total} total in DB)`);
  } catch (err) {
    console.error("Order sync failed:", err);
  }

  // Import investments
  console.log("\nImporting investments...");
  await db.shareholderInvestment.deleteMany({});
  const result = await db.shareholderInvestment.createMany({
    data: investments.map((i) => ({
      name: i.name, amount: i.amount, currency: "EGP",
      date: pd(i.date), notes: "From RB Balance Sheet",
    })),
  });
  console.log(`✅ Imported ${result.count} investments`);

  const byName: Record<string, number> = {};
  for (const i of investments) byName[i.name] = (byName[i.name] ?? 0) + i.amount;
  for (const [name, total] of Object.entries(byName))
    console.log(`  ${name}: ${total.toLocaleString()} EGP`);
  console.log(`  Total: ${investments.reduce((s, i) => s + i.amount, 0).toLocaleString()} EGP`);
}

main().catch(console.error).finally(() => db.$disconnect());
