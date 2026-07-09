import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const db = new PrismaClient();

// Weight per main SKU in grams — all size variants share the same weight
const WEIGHT_BY_MAIN_SKU = {
  R00001: 2.38,  // Duo Stone Ring
  R00002: 5.62,  // Mosaic Ring (avg size-7 measurements)
  R00003: 3.79,  // Wave Ring
  R00004: 5.36,  // Dotted Ring (avg sizes 8–9)
  R00005: 1.60,  // Double Green Ring (Twin Band Ring)
  R00006: 6.62,  // Ridge Ring (avg sizes 6–8)
  R00007: 2.20,  // Trio Blue Ring (Trio Stone Ring)
  R00008: 5.37,  // Signet Ring (avg size-7/8)
  R00009: 4.85,  // Blue Marquise Ring
  R00010: 1.22,  // Mini Green Ring
  R00011: 2.66,  // Green Core Ring (avg size-7)
  R00012: 2.98,  // Green Emerald Cut Ring (avg sizes 6–7)
  B00001: 6.34,  // Wave Cuff (avg of 3 pieces)
  B00002: 6.63,  // Ruby Cuff
  B00003: 8.29,  // Blue Line Cuff
  E00001: 7.79,  // Sunray Earrings
  E00002: 5.78,  // Arabesque Earrings
  N00001: 18.68, // Wave Necklace
};

function getMainSku(sku) {
  if (!sku) return null;
  const m = sku.match(/^([A-Z]\d{5})/);
  return m ? m[1] : null;
}

async function main() {
  const items = await db.inventoryItem.findMany({
    select: { id: true, sku: true, weightG: true, name: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const mainSku = getMainSku(item.sku);
    const weight = mainSku != null ? WEIGHT_BY_MAIN_SKU[mainSku] : undefined;

    if (weight == null) {
      console.log(`  skip  ${item.sku ?? "(no sku)"} — ${item.name}`);
      skipped++;
      continue;
    }

    await db.inventoryItem.update({
      where: { id: item.id },
      data: { weightG: weight },
    });
    console.log(`  set   ${item.sku} → ${weight}g`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`);
}

main()
  .catch((err) => { console.error("Failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
