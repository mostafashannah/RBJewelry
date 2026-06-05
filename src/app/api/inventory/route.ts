export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InventoryStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as InventoryStatus | null;
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, category, material, weightG, quantity, costEGP, priceEGP, photoUrl, notes } = body;

  if (!name || !category || weightG == null) {
    return NextResponse.json({ error: "name, category, and weightG are required" }, { status: 400 });
  }

  const item = await db.inventoryItem.create({
    data: {
      name,
      category,
      material: material ?? "Sterling Silver",
      weightG: parseFloat(weightG),
      quantity: parseInt(quantity ?? "1"),
      costEGP: costEGP ? parseFloat(costEGP) : null,
      priceEGP: priceEGP ? parseFloat(priceEGP) : null,
      photoUrl: photoUrl ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
