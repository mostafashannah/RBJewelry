export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InventoryStatus } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const item = await db.inventoryItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, sku, category, material, weightG, colors, size, quantity,
    metalCostEGP, platingCostEGP, stoneCostEGP, manufacturingCostEGP, transportationCostEGP,
    costEGP, priceEGP, photoUrl, status, orderNo, notes } = body;

  const pf = (v: unknown) => (v ? parseFloat(String(v)) : null);
  const subCosts = [metalCostEGP, platingCostEGP, stoneCostEGP, manufacturingCostEGP, transportationCostEGP];
  const subTotal = subCosts.some(v => v !== undefined)
    ? subCosts.reduce((s, v) => s + (v ? parseFloat(String(v)) : 0), 0)
    : null;
  const finalCost = subTotal !== null && subTotal > 0 ? subTotal
    : (costEGP !== undefined ? (costEGP ? parseFloat(costEGP) : null) : undefined);

  const item = await db.inventoryItem.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(sku !== undefined && { sku: sku || null }),
      ...(category !== undefined && { category }),
      ...(material !== undefined && { material }),
      ...(weightG !== undefined && { weightG: parseFloat(weightG) }),
      ...(colors !== undefined && { colors: Array.isArray(colors) ? colors : [] }),
      ...(size !== undefined && { size: size || null }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(finalCost !== undefined && { costEGP: finalCost }),
      ...(metalCostEGP !== undefined && { metalCostEGP: pf(metalCostEGP) }),
      ...(platingCostEGP !== undefined && { platingCostEGP: pf(platingCostEGP) }),
      ...(stoneCostEGP !== undefined && { stoneCostEGP: pf(stoneCostEGP) }),
      ...(manufacturingCostEGP !== undefined && { manufacturingCostEGP: pf(manufacturingCostEGP) }),
      ...(transportationCostEGP !== undefined && { transportationCostEGP: pf(transportationCostEGP) }),
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
