export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { syncProductsToCache } from "@/lib/ai/product-context";

export async function POST() {
  try {
    await syncProductsToCache();
    return NextResponse.json({ ok: true, message: "Products synced to cache" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
