export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { items } = await req.json() as { items: { title: string; quantity: number }[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ results: [] });

  const allInventory = await db.inventoryItem.findMany({
    select: { name: true, status: true, quantity: true, sku: true },
  });

  const results = items.map(({ title, quantity }) => {
    const needle = title.toLowerCase().trim();
    const matches = allInventory.filter((inv) => {
      const hay = inv.name.toLowerCase().trim();
      return hay.includes(needle) || needle.includes(hay);
    });

    const inStock = matches.filter((m) => m.status === "IN_STOCK").reduce((s, m) => s + m.quantity, 0);
    const reserved = matches.filter((m) => m.status === "RESERVED").length;
    const sold = matches.filter((m) => m.status === "SOLD").length;

    return {
      title,
      quantity,
      found: matches.length > 0,
      inStock,
      reserved,
      sold,
    };
  });

  return NextResponse.json({ results });
}
