import { db } from "@/lib/db";

export async function releaseFromCancelledOrders(): Promise<number> {
  const reserved = await db.inventoryItem.findMany({
    where: { status: "RESERVED", orderNo: { not: null } },
    select: { id: true, orderNo: true },
  });

  if (reserved.length === 0) return 0;

  const orderNos = [...new Set(reserved.map((r) => r.orderNo!))];

  const orders = await db.shopifyOrderCache.findMany({
    where: { orderNumber: { in: orderNos } },
    select: { orderNumber: true, status: true },
  });

  const cancelledNos = new Set(
    orders
      .filter((o) => {
        const s = o.status.toUpperCase();
        return s.includes("VOIDED") || s.includes("CANCEL") || s.includes("REFUNDED");
      })
      .map((o) => o.orderNumber)
  );

  if (cancelledNos.size === 0) return 0;

  const toRelease = reserved.filter((r) => cancelledNos.has(r.orderNo!)).map((r) => r.id);

  if (toRelease.length === 0) return 0;

  await db.inventoryItem.updateMany({
    where: { id: { in: toRelease } },
    data: { status: "IN_STOCK", orderNo: null },
  });

  return toRelease.length;
}
