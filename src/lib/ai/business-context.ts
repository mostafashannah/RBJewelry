import { db } from "@/lib/db";
import { getProductContextString } from "./product-context";

let cache: { data: string; expiresAt: number } | null = null;

type LineItemsJson = {
  customerName?: string;
  items?: { title: string; quantity: number; variantTitle?: string; sku?: string }[];
};

async function getOrdersContext(): Promise<string> {
  const orders = await db.shopifyOrderCache.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  if (!orders.length) return "No orders in database.";

  const lines = orders.map((o) => {
    const meta = o.lineItemsJson as LineItemsJson | null;
    const customer = meta?.customerName ?? o.customerPhone ?? o.customerEmail ?? "—";
    const items = (meta?.items ?? [])
      .map((i) => `${i.quantity}x ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""}`)
      .join(", ");
    const date = o.createdAt.toISOString().split("T")[0];
    const status = o.fulfillmentStatus ?? o.status ?? "—";
    return `• #${o.orderNumber} (${date}) ${customer}: ${items || "—"} — ${o.totalPrice.toLocaleString()} EGP — ${status}`;
  });

  return `=== ORDERS (${orders.length} most recent) ===\n${lines.join("\n")}`;
}

async function getInventoryContext(): Promise<string> {
  const items = await db.inventoryItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  if (!items.length) return "No inventory data.";

  const sold = items.filter((i) => i.status === "SOLD");
  const inStock = items.filter((i) => i.status === "IN_STOCK");

  const soldLines = sold.map((i) =>
    `• ${i.name} (SKU: ${i.sku ?? "—"}) qty:${i.quantity} order:#${i.orderNo ?? "—"} price:${i.priceEGP ?? "—"} EGP cost:${i.costEGP ?? "—"} EGP`
  );

  const stockLines = inStock.map((i) =>
    `• ${i.name} (SKU: ${i.sku ?? "—"}) qty:${i.quantity} cost:${i.costEGP ?? "—"} EGP weight:${i.weightG}g`
  );

  const parts: string[] = [];
  if (sold.length) parts.push(`=== SOLD INVENTORY (${sold.length} items) ===\n${soldLines.join("\n")}`);
  if (inStock.length) parts.push(`=== IN-STOCK INVENTORY (${inStock.length} items) ===\n${stockLines.join("\n")}`);

  return parts.join("\n\n");
}

async function getFinancesContext(): Promise<string> {
  const [expenses, investments, sold, stock, orders] = await Promise.all([
    db.expense.findMany({ orderBy: { date: "desc" } }),
    db.shareholderInvestment.findMany({ orderBy: { date: "desc" } }),
    db.inventoryItem.findMany({
      where: { status: "SOLD" },
      select: { priceEGP: true, costEGP: true, quantity: true },
    }),
    db.inventoryItem.findMany({
      where: { status: "IN_STOCK" },
      select: { costEGP: true, quantity: true },
    }),
    db.shopifyOrderCache.findMany({ select: { totalPrice: true, shippingPrice: true, status: true } }),
  ]);

  const grossRevenue = sold.reduce((s, i) => s + (i.priceEGP ?? 0) * (i.quantity ?? 1), 0);
  const totalCogs = sold.reduce((s, i) => s + (i.costEGP ?? 0) * (i.quantity ?? 1), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const stockValue = stock.reduce((s, i) => s + (i.costEGP ?? 0) * (i.quantity ?? 1), 0);
  const shopifyRevenue = orders
    .filter((o) => o.status.toLowerCase().includes("paid") || o.status.toLowerCase().includes("paid"))
    .reduce((s, o) => s + o.totalPrice - (o.shippingPrice ?? 0), 0);

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const catLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  ${cat}: ${amt.toLocaleString()} EGP`);

  const expenseLines = expenses.slice(0, 30).map((e) => {
    const date = e.date.toISOString().split("T")[0];
    return `  • ${date} [${e.category}] ${e.amount.toLocaleString()} EGP${e.description ? ` — ${e.description}` : ""}`;
  });

  const investLines = investments.map((i) => {
    const date = i.date.toISOString().split("T")[0];
    return `  • ${date} ${i.name}: ${i.amount.toLocaleString()} EGP${i.notes ? ` (${i.notes})` : ""}`;
  });

  return `=== FINANCES ===
Gross Revenue from sales (from inventory): ${grossRevenue.toLocaleString()} EGP
Total COGS (cost of sold inventory): ${totalCogs.toLocaleString()} EGP
Total Expenses: ${totalExpenses.toLocaleString()} EGP
Total Invested by Shareholders: ${totalInvested.toLocaleString()} EGP
Stock Value (cost basis, in-stock items): ${stockValue.toLocaleString()} EGP
Net Profit (Revenue − COGS − Expenses): ${(grossRevenue - totalCogs - totalExpenses).toLocaleString()} EGP
Cash Balance (Invested + Revenue − Expenses): ${(totalInvested + grossRevenue - totalExpenses).toLocaleString()} EGP
Shopify Revenue (from order cache, paid orders): ${shopifyRevenue.toLocaleString()} EGP

Expenses by category:
${catLines.join("\n")}

Recent expenses:
${expenseLines.join("\n")}

Shareholder investments:
${investLines.join("\n")}`;
}

export async function getBusinessContextString(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const [productCtx, ordersCtx, inventoryCtx, financesCtx] = await Promise.all([
    getProductContextString(),
    getOrdersContext(),
    getInventoryContext(),
    getFinancesContext(),
  ]);

  const text = [productCtx, ordersCtx, inventoryCtx, financesCtx].join("\n\n");
  cache = { data: text, expiresAt: Date.now() + 5 * 60 * 1000 };
  return text;
}
