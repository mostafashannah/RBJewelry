export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getProducts } from "@/lib/shopify/admin";

export async function GET() {
  try {
    const { products } = await getProducts(50);
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
