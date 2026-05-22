export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month"); // e.g. "2025-05"

  const where: Record<string, unknown> = {};
  if (month) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }

  const expenses = await db.expense.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json({ expenses });
}

const schema = z.object({
  category: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("EGP"),
  description: z.string().optional(),
  date: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const expense = await db.expense.create({
    data: { ...parsed.data, date: new Date(parsed.data.date) },
  });
  return NextResponse.json(expense, { status: 201 });
}
