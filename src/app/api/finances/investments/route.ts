export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const investments = await db.shareholderInvestment.findMany({ orderBy: { date: "desc" } });
    return NextResponse.json({ investments });
  } catch (err) {
    return NextResponse.json({ error: String(err), investments: [] }, { status: 500 });
  }
}

const schema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("EGP"),
  date: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const inv = await db.shareholderInvestment.create({
      data: { ...parsed.data, date: new Date(parsed.data.date) },
    });
    return NextResponse.json(inv, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await db.shareholderInvestment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
