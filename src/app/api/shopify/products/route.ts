export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const products = await db.shopifyProductCache.findMany({ orderBy: { syncedAt: "desc" } });
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: String(err), products: [] }, { status: 500 });
  }
}
