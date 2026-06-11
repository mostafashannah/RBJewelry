export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { debugShopifyQL } from "@/lib/shopify/admin";

export async function GET() {
  try {
    const result = await debugShopifyQL([
      "FROM sessions SHOW sessions SINCE -30d UNTIL today",
      "FROM sessions SHOW landing_page_path, sessions GROUP BY landing_page_path ORDER BY sessions DESC LIMIT 10 SINCE -30d UNTIL today",
    ]);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
