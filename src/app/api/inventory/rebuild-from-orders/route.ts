export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSheet } from "@/lib/google/sheets";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = "2025-01";

async function shopifyFetch(query: string, variables: Record<string, unknown>) {
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(", "));
  return json.data;
}

interface ShopifyLineItem {
  title: string;
  quantity: number;
  originalUnitPriceSet: { shopMoney: { amount: string } };
  variant: { title: string; sku: string | null } | null;
}

interface ShopifyOrderNode {
  name: string;
  lineItems: { edges: { node: ShopifyLineItem }[] };
}

async function fetchAllPaidOrders(): Promise<ShopifyOrderNode[]> {
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

  const all: ShopifyOrderNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyFetch(query, { first: 250, after: cursor }) as {
      orders: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: ShopifyOrderNode }[];
      };
    };
    for (const { node } of data.orders.edges) all.push(node);
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  return all;
}

async function readCostsFromSheets(): Promise<Map<string, number>> {
  const costs = new Map<string, number>();
  const sheetsId = process.env.GOOGLE_SHEETS_STOCK_ID;
  if (!sheetsId) return costs;

  const tabs = ["Inventory", "Cost", "Costs", "Products", "Stock"];
  for (const tab of tabs) {
    try {
      const headerRows = await readSheet(sheetsId, `${tab}!A1:Z1`);
      if (!headerRows?.length) continue;
      const headers = headerRows[0].map((h: unknown) => String(h ?? "").toLowerCase().trim());
      const skuIdx = headers.findIndex((h: string) => h === "sku" || h === "كود" || h.includes("sku"));
      const costIdx = headers.findIndex((h: string) => h.includes("cost") || h.includes("تكلفة") || h === "cost (egp)");
      if (skuIdx === -1 || costIdx === -1) continue;

      const dataRows = await readSheet(sheetsId, `${tab}!A2:Z`);
      for (const row of dataRows ?? []) {
        const sku = String(row[skuIdx] ?? "").trim();
        const raw = String(row[costIdx] ?? "").replace(/[^\d.]/g, "");
        const cost = parseFloat(raw);
        if (sku && !isNaN(cost) && cost > 0) costs.set(sku.toLowerCase(), cost);
      }
      if (costs.size > 0) break;
    } catch {
      continue;
    }
  }

  return costs;
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("earring")) return "Earrings";
  if (t.includes("necklace")) return "Necklace";
  if (t.includes("bracelet")) return "Bracelet";
  if (t.includes("anklet")) return "Anklet";
  if (t.includes("set")) return "Set";
  if (t.includes("ring")) return "Ring";
  return "Other";
}

function extractSize(variantTitle: string | null | undefined): string | null {
  if (!variantTitle) return null;
  const m = variantTitle.match(/\b(size\s*)?(\d+(?:\.\d+)?)\b/i);
  return m ? m[2] : null;
}

export async function POST() {
  try {
    // Step 1: Capture existing cost and weight data before deleting
    const existing = await db.inventoryItem.findMany({
      select: { sku: true, name: true, costEGP: true, weightG: true },
    });

    const costBySku = new Map<string, number>();
    const costByName = new Map<string, number>();
    const weightBySku = new Map<string, number>();
    const weightByName = new Map<string, number>();

    for (const item of existing) {
      const nameLower = item.name.toLowerCase();
      if (item.sku) {
        const skuLower = item.sku.toLowerCase();
        if (item.costEGP != null) costBySku.set(skuLower, item.costEGP);
        if (item.weightG) weightBySku.set(skuLower, item.weightG);
      }
      if (item.costEGP != null) costByName.set(nameLower, item.costEGP);
      if (item.weightG) weightByName.set(nameLower, item.weightG);
    }

    // Step 2: Try Google Sheets for additional cost data
    const sheetCosts = await readCostsFromSheets();
    sheetCosts.forEach((cost, sku) => {
      if (!costBySku.has(sku)) costBySku.set(sku, cost);
    });

    // Step 3: Delete all inventory items
    const { count: deleted } = await db.inventoryItem.deleteMany({});

    // Step 4: Fetch all paid orders from Shopify with line-item prices + SKUs
    const orders = await fetchAllPaidOrders();

    // Step 5: Create SOLD inventory items for each line item
    let created = 0;
    for (const order of orders) {
      const orderNo = order.name.replace("#", "");
      for (const { node: li } of order.lineItems.edges) {
        const rawVariant = li.variant?.title;
        const isDefault = !rawVariant || rawVariant === "Default Title";
        const variantLabel = isDefault ? null : rawVariant;

        const sku = li.variant?.sku || null;
        const nameFull = variantLabel ? `${li.title} (${variantLabel})` : li.title;
        const nameLower = li.title.toLowerCase();
        const skuLower = sku?.toLowerCase() ?? null;

        const costEGP =
          (skuLower ? costBySku.get(skuLower) : undefined) ??
          costByName.get(nameLower) ??
          null;

        const weightG =
          (skuLower ? weightBySku.get(skuLower) : undefined) ??
          weightByName.get(nameLower) ??
          0;

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
            weightG,
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

    return NextResponse.json({ ok: true, deleted, created, orders: orders.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
