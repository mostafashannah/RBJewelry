export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [expenses, orders, stockItems, investments] = await Promise.all([
      db.expense.findMany(),
      db.shopifyOrderCache.findMany(),
      db.inventoryItem.findMany({ where: { status: "IN_STOCK" } }),
      db.shareholderInvestment.findMany().catch(() => []),
    ]);

    // Revenue: paid orders minus shipping — handle both webhook format ("paid") and sync format ("PAID / FULFILLED")
    const paidOrders = orders.filter((o) => o.status.toLowerCase().includes("paid"));
    const revenue = paidOrders.reduce((s, o) => s + o.totalPrice - (o.shippingPrice ?? 0), 0);

    // Expenses
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Stock value at cost
    const stockValue = stockItems.reduce((s, i) => s + (i.costEGP ?? 0) * i.quantity, 0);

    // By expense category
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

    return NextResponse.json({
      revenue,
      totalExpenses,
      profit: revenue - totalExpenses,
      balance: totalInvested + revenue - totalExpenses,
      stockValue,
      stockItemCount: stockItems.length,
      paidOrderCount: paidOrders.length,
      byCategory,
      totalInvested,
      investmentCount: investments.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[finances/summary]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
