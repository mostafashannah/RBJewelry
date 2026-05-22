export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/lib/shopify/admin";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "any";
  try {
    const { orders } = await getOrders(50, status);
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
