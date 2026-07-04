/**
 * One-time inventory setup: populates inventory from all paid Shopify orders.
 * Skips automatically if SOLD items already exist in the database.
 * Cost per piece sourced from the RB Jewelry Product Inventory Sheet + 80 EGP packaging.
 */
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Cost per piece (EGP) = material + plating + 80 packaging.
// Same-size rule: sizes not in the sheet use the same cost as the measured size of that SKU.
const PACKAGING = 80;
const COST_BY_SKU = {
  // Duo Stone Ring (R00001-G) — 528 material + 80 packaging
  "R00001-G-6": 608, "R00001-G-7": 608, "R00001-G-8": 608, "R00001-G-9": 608,
  // Mosaic Ring (R00002) — sizes 7 & 9 measured; 6 & 8 use average
  "R00002-6": 1037, "R00002-7": 1208, "R00002-8": 1037, "R00002-9": 866,
  // Wave Ring (R00003) — 782 material + 80 packaging
  "R00003-6": 862, "R00003-7": 862, "R00003-8": 862, "R00003-9": 862,
  // Dotted Ring (R00004) — size 8 & 9 measured; 6 & 7 use size-8 value
  "R00004-6": 1115, "R00004-7": 1115, "R00004-8": 1115, "R00004-9": 1206,
  // Ridge Ring (R00006) — sizes 6, 7, 8 measured
  "R00006-6": 1246, "R00006-7": 1275, "R00006-8": 1291, "R00006-9": 1275,
  // Trio Blue Ring (R00007) — 750 EGP (manual entry) + 80 packaging
  "R00007-6": 830, "R00007-7": 830, "R00007-8": 830, "R00007-9": 830,
  // Signet Ring (R00008) — sizes 7 & 8 measured; 6 uses size-7 value
  "R00008-6": 1148, "R00008-7": 1148, "R00008-8": 1143, "R00008-9": 1148,
  // Blue Marquise Ring (R00009) — size 7 measured; others use same
  "R00009-6": 953, "R00009-7": 953, "R00009-8": 953, "R00009-9": 953,
  // Mini Green Ring (R00010) — 220 material + 80 packaging
  "R00010-6": 300, "R00010-7": 300, "R00010-8": 300, "R00010-9": 300,
  // Green Core Ring (R00011) — size 7 avg 579, size 8 = 243
  "R00011-6": 660, "R00011-7": 660, "R00011-8": 323, "R00011-9": 323,
  // Green Emerald Cut Ring (R00012) — sizes 6 & 7 measured
  "R00012-6": 752, "R00012-7": 679, "R00012-8": 752, "R00012-9": 679,
  // Wave Cuff (B00001) — avg of 3 measured pieces
  "B00001": 1321,
  // Ruby Cuff (B00002)
  "B00002": 1373,
  // Blue Line Cuff (B00003)
  "B00003": 1672,
  // Sunray Earrings (E00001)
  "E00001-G": 1482, "E00001-R": 1482, "E00001-B": 1482,
  // Arabesque Earrings (E00002)
  "E00002": 1120,
  // Wave Necklace (N00001)
  "N00001": 3442,
};

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
  if (t.includes("bracelet") || t.includes("cuff")) return "Bracelet";
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
  console.log("Running inventory rebuild from paid orders...");

  const orders = await fetchAllPaidOrders();
  console.log(`Fetched ${orders.length} paid orders from Shopify.`);

  let created = 0;
  let missingCost = 0;
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

      const costEGP = sku && COST_BY_SKU[sku] != null ? COST_BY_SKU[sku] : null;
      if (costEGP == null) missingCost++;

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
          costEGP,
          priceEGP,
          status: "SOLD",
          orderNo,
        },
      });
      created++;
    }
  }

  console.log(`Done. Created ${created} SOLD items (${missingCost} without cost data) from ${orders.length} paid orders.`);
}

main()
  .catch((err) => { console.error("Rebuild failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
