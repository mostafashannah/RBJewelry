export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const orders = await db.shopifyOrderCache.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: String(err), orders: [] }, { status: 500 });
  }
}
