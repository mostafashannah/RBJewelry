/**
 * One-time inventory setup: populates inventory from all paid Shopify orders.
 * Skips automatically if SOLD items already exist in the database.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const API_VERSION = "2025-01";

async function shopifyFetch(query, variables) {
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    const msg = Array.isArray(json.errors)
      ? json.errors.map((e) => e.message ?? String(e)).join(", ")
      : JSON.stringify(json.errors);
    throw new Error(msg);
  }
  return json.data;
}

async function fetchAllPaidOrders() {
  const query = `
    query getPaidOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, query: "financial_status:paid") {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            name
            lineItems(first: 20) {
              edges {
                node {
                  title
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  variant { title sku }
                }
              }
            }
          }
        }
      }
    }
  `;
  const all = [];
  let cursor = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await shopifyFetch(query, { first: 250, after: cursor });
    for (const { node } of data.orders.edges) all.push(node);
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }
  return all;
}

function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("earring")) return "Earrings";
  if (t.includes("necklace")) return "Necklace";
  if (t.includes("bracelet")) return "Bracelet";
  if (t.includes("anklet")) return "Anklet";
  if (t.includes("set")) return "Set";
  if (t.includes("ring")) return "Ring";
  return "Other";
}

function extractSize(variantTitle) {
  if (!variantTitle) return null;
  const m = variantTitle.match(/\b(size\s*)?(\d+(?:\.\d+)?)\b/i);
  return m ? m[2] : null;
}

async function main() {
  // Skip if already populated
  const existingCount = await db.inventoryItem.count({ where: { status: "SOLD" } });
  if (existingCount > 0) {
    console.log(`Inventory already has ${existingCount} SOLD items — skipping rebuild.`);
    return;
  }

  console.log("No SOLD items found. Running one-time inventory rebuild from paid orders...");

  const orders = await fetchAllPaidOrders();
  console.log(`Fetched ${orders.length} paid orders from Shopify.`);

  let created = 0;
  for (const order of orders) {
    const orderNo = order.name.replace("#", "");
    for (const { node: li } of order.lineItems.edges) {
      const rawVariant = li.variant?.title;
      const isDefault = !rawVariant || rawVariant === "Default Title";
      const variantLabel = isDefault ? null : rawVariant;
      const sku = li.variant?.sku || null;
      const nameFull = variantLabel ? `${li.title} (${variantLabel})` : li.title;
      const priceEGP = li.originalUnitPriceSet?.shopMoney?.amount
        ? parseFloat(li.originalUnitPriceSet.shopMoney.amount)
        : null;
      const size = extractSize(variantLabel);

      await db.inventoryItem.create({
        data: {
          name: nameFull,
          sku: sku || null,
          category: inferCategory(nameFull),
          material: "Sterling Silver",
          weightG: 0,
          colors: [],
          size: size ?? undefined,
          quantity: li.quantity,
          costEGP: null,
          priceEGP,
          status: "SOLD",
          orderNo,
        },
      });
      created++;
    }
  }

  console.log(`Done. Created ${created} SOLD inventory items from ${orders.length} paid orders.`);
}

main()
  .catch((err) => { console.error("Rebuild failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
