export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const baseSku = searchParams.get("sku");
  if (!baseSku) return NextResponse.json({ avg: 0, count: 0 });

  const items = await db.inventoryItem.findMany({
    where: {
      sku: { startsWith: baseSku },
      stoneCostEGP: { not: null },
    },
    select: { stoneCostEGP: true },
  });

  if (!items.length) return NextResponse.json({ avg: 0, count: 0 });
  const avg = items.reduce((s, i) => s + (i.stoneCostEGP ?? 0), 0) / items.length;
  return NextResponse.json({ avg: Math.round(avg), count: items.length });
}
