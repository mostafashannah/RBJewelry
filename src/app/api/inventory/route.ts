export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InventoryStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") as InventoryStatus | null;
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[inventory] GET failed:", msg);
    return NextResponse.json({ error: msg, items: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sku, category, material, weightG, colors, size, quantity, costEGP, priceEGP, photoUrl, orderNo, notes } = body;

  if (!name || !category || weightG == null) {
    return NextResponse.json({ error: "name, category, and weightG are required" }, { status: 400 });
  }

  const item = await db.inventoryItem.create({
    data: {
      name,
      sku: sku || null,
      category,
      material: material ?? "Sterling Silver",
      weightG: parseFloat(weightG),
      colors: Array.isArray(colors) ? colors : [],
      size: size || null,
      quantity: parseInt(quantity ?? "1"),
      costEGP: costEGP ? parseFloat(costEGP) : null,
      priceEGP: priceEGP ? parseFloat(priceEGP) : null,
      photoUrl: photoUrl ?? null,
      orderNo: orderNo || null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
