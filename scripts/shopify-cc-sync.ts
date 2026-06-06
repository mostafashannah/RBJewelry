import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const db = new PrismaClient();
const SHOP = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(".myshopify.com", "");
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed ${res.status}: ${text}`);
  }

  const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number };
  cachedToken = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  console.log(`✅ Got token (expires in ${expires_in}s)`);
  return access_token;
}

async function gql(query: string) {
  const token = await getToken();
  const res = await fetch(`https://${SHOP}.myshopify.com/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL failed: ${res.status}`);
  const { data, errors } = await res.json() as { data: Record<string, unknown>; errors?: { message: string }[] };
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  return data;
}

async function main() {
  console.log(`Shop: ${SHOP}.myshopify.com`);

  const data = await gql(`{
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name createdAt email phone
        totalPriceSet { shopMoney { amount currencyCode } }
        displayFinancialStatus displayFulfillmentStatus
        fulfillments(first: 1) { trackingInfo { number url } }
        shippingAddress { firstName lastName phone }
        lineItems(first: 5) { edges { node { title quantity } } }
      }}
    }
  }`);

  const orders = (data.orders as { edges: { node: Record<string, unknown> }[] }).edges;
  console.log(`Got ${orders.length} orders`);

  let upserted = 0;
  for (const { node: o } of orders) {
    const price = o.totalPriceSet as { shopMoney: { amount: string; currencyCode: string } };
    const items = (o.lineItems as { edges: { node: { title: string; quantity: number } }[] }).edges;
    const shipping = o.shippingAddress as { firstName?: string; lastName?: string; phone?: string } | null;
    const fulfillments = (o.fulfillments as { trackingInfo: { number: string; url: string }[] }[]);
    const tracking = fulfillments?.[0]?.trackingInfo?.[0];
    const customerName = shipping ? `${shipping.firstName ?? ""} ${shipping.lastName ?? ""}`.trim() : null;
    const payment = o.displayFinancialStatus as string;
    const fulfillment = (o.displayFulfillmentStatus as string) ?? "UNFULFILLED";
    const status = `${payment} / ${fulfillment}`;

    await db.shopifyOrderCache.upsert({
      where: { id: o.id as string },
      update: {
        status, totalPrice: parseFloat(price.shopMoney.amount),
        fulfillmentStatus: fulfillment,
        trackingNumber: tracking?.number ?? null,
        trackingUrl: tracking?.url ?? null,
        syncedAt: new Date(),
        lineItemsJson: { customerName, items: items.map(e => ({ title: e.node.title, quantity: e.node.quantity })) },
      },
      create: {
        id: o.id as string,
        orderNumber: (o.name as string).replace("#", ""),
        customerEmail: o.email as string | null,
        customerPhone: (o.phone as string | null) ?? shipping?.phone ?? null,
        totalPrice: parseFloat(price.shopMoney.amount),
        currency: price.shopMoney.currencyCode,
        status, fulfillmentStatus: fulfillment,
        trackingNumber: tracking?.number ?? null,
        trackingUrl: tracking?.url ?? null,
        lineItemsJson: { customerName, items: items.map(e => ({ title: e.node.title, quantity: e.node.quantity })) },
        createdAt: new Date(o.createdAt as string),
      },
    });
    upserted++;
  }

  const total = await db.shopifyOrderCache.count();
  const paid = orders.filter(({ node: o }) => (o.displayFinancialStatus as string) === "PAID");
  const revenue = paid.reduce((s, { node: o }) => s + parseFloat((o.totalPriceSet as { shopMoney: { amount: string } }).shopMoney.amount), 0);
  console.log(`✅ Synced ${upserted} orders (${total} total in DB)`);
  console.log(`Paid: ${paid.length} orders — Revenue: ${revenue.toLocaleString()} EGP`);
}

main().catch(console.error).finally(() => db.$disconnect());
