export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InventoryStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, category, material, weightG, quantity, costEGP, priceEGP, photoUrl, status, notes } = body;

  const item = await db.inventoryItem.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(material !== undefined && { material }),
      ...(weightG !== undefined && { weightG: parseFloat(weightG) }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(costEGP !== undefined && { costEGP: costEGP ? parseFloat(costEGP) : null }),
      ...(priceEGP !== undefined && { priceEGP: priceEGP ? parseFloat(priceEGP) : null }),
      ...(photoUrl !== undefined && { photoUrl }),
      ...(status !== undefined && { status: status as InventoryStatus }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
