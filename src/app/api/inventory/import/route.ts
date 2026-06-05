export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const preview = formData.get("preview") === "true";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  // Normalize headers — accept various column name formats
  const normalize = (row: Record<string, unknown>) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.entries(row).find(([key]) => key.trim().toLowerCase() === k.toLowerCase());
        if (found && found[1] !== "") return String(found[1]).trim();
      }
      return null;
    };

    const name = get("name", "item name", "اسم القطعة", "item");
    const category = get("category", "type", "نوع", "الفئة") ?? "Other";
    const material = get("material", "خامة", "المادة") ?? "Sterling Silver";
    const weightRaw = get("weight", "weight_g", "weight (g)", "الوزن", "وزن");
    const weightG = weightRaw ? parseFloat(weightRaw.replace(/[^0-9.]/g, "")) : null;
    const quantity = parseInt(get("quantity", "qty", "الكمية") ?? "1") || 1;
    const costEGP = parseFloat(get("cost", "cost_egp", "التكلفة") ?? "0") || null;
    const priceEGP = parseFloat(get("price", "price_egp", "selling price", "السعر") ?? "0") || null;
    const sku = get("sku", "code", "كود", "رقم") ?? null;
    const notes = get("notes", "note", "ملاحظات") ?? null;

    return { name, category, material, weightG, quantity, costEGP, priceEGP, sku, notes };
  };

  const parsed = rows
    .map(normalize)
    .filter((r) => r.name && r.weightG !== null && !isNaN(r.weightG!));

  if (preview) {
    return NextResponse.json({ rows: parsed.slice(0, 10), total: parsed.length });
  }

  // Bulk create
  const created = await db.inventoryItem.createMany({
    data: parsed.map((r) => ({
      name: r.name!,
      category: r.category,
      material: r.material,
      weightG: r.weightG!,
      quantity: r.quantity,
      costEGP: r.costEGP,
      priceEGP: r.priceEGP,
      notes: r.sku ? `SKU: ${r.sku}${r.notes ? " | " + r.notes : ""}` : (r.notes ?? null),
    })),
    skipDuplicates: false,
  });

  return NextResponse.json({ imported: created.count });
}
