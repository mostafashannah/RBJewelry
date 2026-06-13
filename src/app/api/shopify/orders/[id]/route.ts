export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchOrderDetail } from "@/lib/shopify/admin";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const detail = await fetchOrderDetail(params.id);
    return NextResponse.json({ order: detail });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
