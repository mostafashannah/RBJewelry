export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getProducts, setInventoryLevel, getLocations } from "@/lib/shopify/admin";
import { readSheet, writeSheet } from "@/lib/google/sheets";

const SHEETS_ID = process.env.GOOGLE_SHEETS_STOCK_ID!;

export async function POST(req: NextRequest) {
  const { direction } = await req.json() as { direction: "push" | "pull" };

  if (direction === "push") {
    // Push Shopify inventory → Google Sheets
    const { products } = await getProducts(250);
    const rows: (string | number)[][] = [
      ["Product ID", "Title", "Handle", "Variant", "SKU", "Inventory", "Price (EGP)", "Inventory Item ID"],
    ];
    for (const p of products) {
      for (const v of p.variants) {
        rows.push([p.id, p.title, p.handle, v.title, v.sku, v.inventory_quantity, parseFloat(v.price), v.inventory_item_id]);
      }
    }
    await writeSheet(SHEETS_ID, "Stock!A1", rows);
    return NextResponse.json({ ok: true, rowsWritten: rows.length - 1 });
  }

  if (direction === "pull") {
    // Pull Google Sheets → update Shopify inventory
    const rows = await readSheet(SHEETS_ID, "Stock!A2:G");
    const { locations } = await getLocations();
    const locationId = locations[0]?.id;
    if (!locationId) return NextResponse.json({ error: "No location found" }, { status: 400 });

    let updated = 0;
    for (const row of rows) {
      const [, , , , , inventoryStr, , inventoryItemId] = row;
      const qty = parseInt(inventoryStr);
      if (isNaN(qty) || !inventoryItemId) continue;
      await setInventoryLevel(inventoryItemId, locationId, qty);
      updated++;
    }
    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ error: "direction must be push or pull" }, { status: 400 });
}
