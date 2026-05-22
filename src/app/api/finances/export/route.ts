export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrders } from "@/lib/shopify/admin";
import { writeSheet } from "@/lib/google/sheets";

const FINANCE_SHEET_ID = process.env.GOOGLE_SHEETS_FINANCE_ID!;

export async function POST(req: NextRequest) {
  const { month } = await req.json() as { month: string }; // "2025-05"
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59);

  const [expenses, orders] = await Promise.all([
    db.expense.findMany({ where: { date: { gte: start, lte: end } } }),
    getOrders(250),
  ]);

  const monthOrders = orders.orders.filter((o) => {
    const d = new Date(o.created_at);
    return d >= start && d <= end;
  });

  const revenue = monthOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - totalExpenses;

  const rows: (string | number)[][] = [
    ["Month", month],
    ["Revenue (EGP)", revenue],
    ["Total Expenses (EGP)", totalExpenses],
    ["Net Profit (EGP)", profit],
    [],
    ["Expense Category", "Amount (EGP)", "Description", "Date"],
    ...expenses.map((e) => [e.category, e.amount, e.description ?? "", e.date.toISOString().split("T")[0]]),
  ];

  await writeSheet(FINANCE_SHEET_ID, `Finance_${month}!A1`, rows);
  return NextResponse.json({ ok: true, revenue, totalExpenses, profit });
}
