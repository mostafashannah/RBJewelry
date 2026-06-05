export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InventoryStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, sku, category, material, weightG, colors, quantity, costEGP, priceEGP, photoUrl, status, orderNo, notes } = body;

  const item = await db.inventoryItem.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(sku !== undefined && { sku: sku || null }),
      ...(category !== undefined && { category }),
      ...(material !== undefined && { material }),
      ...(weightG !== undefined && { weightG: parseFloat(weightG) }),
      ...(colors !== undefined && { colors: Array.isArray(colors) ? colors : [] }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(costEGP !== undefined && { costEGP: costEGP ? parseFloat(costEGP) : null }),
      ...(priceEGP !== undefined && { priceEGP: priceEGP ? parseFloat(priceEGP) : null }),
      ...(photoUrl !== undefined && { photoUrl }),
      ...(status !== undefined && { status: status as InventoryStatus }),
      ...(orderNo !== undefined && { orderNo: orderNo || null }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
