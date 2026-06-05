export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET() {
  const items = await db.inventoryItem.findMany({ orderBy: { createdAt: "asc" } });

  const rows = items.map((item) => ({
    SKU: item.sku ?? "",
    "Product Name": item.name,
    Category: item.category,
    Material: item.material,
    Color: item.colors?.join(", ") ?? "",
    "Weight (g)": item.weightG,
    Quantity: item.quantity,
    "Cost (EGP)": item.costEGP ?? "",
    "Price (EGP)": item.priceEGP ?? "",
    Status: item.status,
    "Order No": item.orderNo ?? "",
    Notes: item.notes ?? "",
    "Photo URL": item.photoUrl ?? "",
    "Date Added": item.createdAt.toISOString().split("T")[0],
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RBJewelry-Inventory-${date}.xlsx"`,
    },
  });
}
