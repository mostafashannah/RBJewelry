/**
 * Rebuilds SOLD inventory from static paid-order data fetched 2026-07-04 via Shopify MCP.
 * No Shopify API call required — data is embedded below.
 * Cost per piece = material + plating + 80 EGP packaging.
 */
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const COST_BY_SKU = {
  // Duo Stone Ring Gold (R00001-G) — 528 material + 80 packaging
  "R00001-G-6": 608, "R00001-G-7": 608, "R00001-G-8": 608, "R00001-G-9": 608,
  // Duo Stone Ring Green (R00001-GR) — same cost as Gold variant
  "R00001-GR-6": 608, "R00001-GR-7": 608, "R00001-GR-8": 608, "R00001-GR-9": 608,
  // Mosaic Ring (R00002) — sizes 7 & 9 measured; 6 & 8 use average
  "R00002-6": 1037, "R00002-7": 1208, "R00002-8": 1037, "R00002-9": 866,
  // Wave Ring (R00003) — 782 material + 80 packaging
  "R00003-6": 862, "R00003-7": 862, "R00003-8": 862, "R00003-9": 862,
  // Dotted Ring (R00004) — size 8 & 9 measured; 6 & 7 use size-8 value
  "R00004-6": 1115, "R00004-7": 1115, "R00004-8": 1115, "R00004-9": 1206,
  // Ridge Ring (R00006) — sizes 6, 7, 8 measured
  "R00006-6": 1246, "R00006-7": 1275, "R00006-8": 1291, "R00006-9": 1275,
  // Trio Blue Ring (R00007) — 750 EGP + 80 packaging
  "R00007-6": 830, "R00007-7": 830, "R00007-8": 830, "R00007-9": 830,
  // Signet Ring (R00008) — sizes 7 & 8 measured; 6 uses size-7 value
  "R00008-6": 1148, "R00008-7": 1148, "R00008-8": 1143, "R00008-9": 1148,
  // Blue Marquise Ring (R00009) — size 7 measured; others use same
  "R00009-6": 953, "R00009-7": 953, "R00009-8": 953, "R00009-9": 953,
  // Mini Green Ring (R00010) — 220 material + 80 packaging
  "R00010-6": 300, "R00010-7": 300, "R00010-8": 300, "R00010-9": 300,
  // Mini Green Ring with color suffix variants
  "R00010-GR-6": 300, "R00010-GR-7": 300, "R00010-GR-8": 300, "R00010-GR-9": 300,
  // Green Core Ring (R00011) — size 7 avg 579, size 8 = 243
  "R00011-6": 660, "R00011-7": 660, "R00011-8": 323, "R00011-9": 323,
  // Green Emerald Cut Ring (R00012) — sizes 6 & 7 measured
  "R00012-6": 752, "R00012-7": 679, "R00012-8": 752, "R00012-9": 679,
  // Wave Cuff (B00001)
  "B00001": 1321,
  // Ruby Cuff (B00002)
  "B00002": 1373,
  // Blue Line Cuff (B00003)
  "B00003": 1672,
  // Sunray Earrings (E00001)
  "E00001-G": 1482, "E00001-R": 1482, "E00001-B": 1482,
  // Arabesque Earrings (E00002)
  "E00002": 1120,
  // Wave Necklace (N00001)
  "N00001": 3442,
};

// All paid orders fetched 2026-07-04 from Shopify (financial_status:paid)
const LINE_ITEMS = [
  { orderNo: "1004", title: "The Trio Blue Ring", variantTitle: "8", sku: "R00007-8", quantity: 1, priceEGP: 999 },
  { orderNo: "1006", title: "The Dotted Ring", variantTitle: "8", sku: "R00004-8", quantity: 1, priceEGP: 1899 },
  { orderNo: "1006", title: "The Wave Ring", variantTitle: "8", sku: "R00003-8", quantity: 1, priceEGP: 1399 },
  { orderNo: "1007", title: "The Green Emerald Cut Ring", variantTitle: "6", sku: "R00012-6", quantity: 1, priceEGP: 1099 },
  { orderNo: "1008", title: "Wave Ring", variantTitle: "7", sku: "R00003-7", quantity: 1, priceEGP: 1399 },
  { orderNo: "1010", title: "Duo Stone Ring", variantTitle: "Green / 7", sku: "R00001-GR-7", quantity: 1, priceEGP: 1199 },
  { orderNo: "1011", title: "Ridge Ring", variantTitle: "7", sku: "R00006-7", quantity: 1, priceEGP: 2099 },
  { orderNo: "1011", title: "Mosaic Ring", variantTitle: "7", sku: "R00002-7", quantity: 1, priceEGP: 1199 },
  { orderNo: "1012", title: "Ruby Cuff", variantTitle: null, sku: "B00002", quantity: 1, priceEGP: 2699 },
  { orderNo: "1013", title: "Mini Green Ring", variantTitle: "Green / 8", sku: "R00010-GR-8", quantity: 1, priceEGP: 699 },
  { orderNo: "1014", title: "Ridge Ring", variantTitle: "6", sku: "R00006-6", quantity: 1, priceEGP: 2099 },
  { orderNo: "1015", title: "Duo Stone Ring", variantTitle: "Green / 7", sku: "R00001-GR-7", quantity: 1, priceEGP: 1499 },
  { orderNo: "1016", title: "Duo Stone Ring", variantTitle: "Green / 6", sku: "R00001-GR-6", quantity: 1, priceEGP: 1499 },
  { orderNo: "1017", title: "Dotted Ring", variantTitle: "7", sku: "R00004-7", quantity: 1, priceEGP: 1999 },
  { orderNo: "1018", title: "Dotted Ring", variantTitle: "7", sku: "R00004-7", quantity: 1, priceEGP: 1999 },
  { orderNo: "1018", title: "Trio Stone Ring", variantTitle: "7", sku: "R00007-7", quantity: 1, priceEGP: 1299 },
  { orderNo: "1019", title: "Emerald Cut Ring", variantTitle: "6", sku: "R00012-6", quantity: 1, priceEGP: 1499 },
  { orderNo: "1020", title: "Mini Band Ring", variantTitle: "Green / 7", sku: "R00010-GR-7", quantity: 1, priceEGP: 899 },
  { orderNo: "1022", title: "Mosaic Ring", variantTitle: "7", sku: "R00002-7", quantity: 1, priceEGP: 1899 },
  { orderNo: "1023", title: "Wave Ring", variantTitle: "9", sku: "R00003-9", quantity: 1, priceEGP: 1599 },
  { orderNo: "1024", title: "Core Ring", variantTitle: "8", sku: "R00011-8", quantity: 1, priceEGP: 1399 },
  { orderNo: "1026", title: "Wave Ring", variantTitle: "8", sku: "R00003-8", quantity: 1, priceEGP: 1599 },
  { orderNo: "1027", title: "Ruby Cuff", variantTitle: null, sku: "B00002", quantity: 1, priceEGP: 2399 },
  { orderNo: "1028", title: "Arabesque Earrings", variantTitle: null, sku: "E00002", quantity: 1, priceEGP: 1999 },
  { orderNo: "1029", title: "Duo Stone Ring", variantTitle: "Green / 8", sku: "R00001-GR-8", quantity: 1, priceEGP: 1499 },
  { orderNo: "1031", title: "Marquise Ring", variantTitle: "8", sku: "R00009-8", quantity: 1, priceEGP: 1699 },
  { orderNo: "1032", title: "Wave Ring", variantTitle: "8", sku: "R00003-8", quantity: 1, priceEGP: 1699 },
  { orderNo: "1032", title: "Mosaic Ring", variantTitle: "8", sku: "R00002-8", quantity: 1, priceEGP: 1899 },
  { orderNo: "1035", title: "Wave Ring", variantTitle: "9", sku: "R00003-9", quantity: 1, priceEGP: 1699 },
  { orderNo: "1035", title: "Mosaic Ring", variantTitle: "9", sku: "R00002-9", quantity: 1, priceEGP: 1899 },
  { orderNo: "1039", title: "Signet Ring", variantTitle: "6", sku: "R00008-6", quantity: 1, priceEGP: 2099 },
  { orderNo: "1039", title: "Signet Ring", variantTitle: "7", sku: "R00008-7", quantity: 1, priceEGP: 2099 },
  { orderNo: "1040", title: "Wave Ring — Minimalist Gold Plated Sterling Silver Open Ring for Women", variantTitle: "9", sku: "R00003-9", quantity: 1, priceEGP: 1799 },
  { orderNo: "1040", title: "Mosaic Ring — Gold Plated Sterling Silver Ring with Colored Stones for Women", variantTitle: "9", sku: "R00002-9", quantity: 1, priceEGP: 1999 },
  { orderNo: "1042", title: "Mosaic Ring — Gold Plated Sterling Silver Ring with Colored Stones for Women", variantTitle: "7", sku: "R00002-7", quantity: 1, priceEGP: 1999 },
  { orderNo: "1043", title: "Core Ring", variantTitle: "9", sku: "R00011-9", quantity: 1, priceEGP: 1599 },
  { orderNo: "1043", title: "Marquise Ring", variantTitle: "9", sku: "R00009-9", quantity: 1, priceEGP: 1699 },
  { orderNo: "1049", title: "Mosaic Ring — Gold Plated Sterling Silver Ring with Colored Stones for Women", variantTitle: "9", sku: "R00002-9", quantity: 1, priceEGP: 2299 },
  { orderNo: "1050", title: "Mosaic Ring — Gold Plated Sterling Silver Ring with Colored Stones for Women", variantTitle: "6", sku: "R00002-6", quantity: 1, priceEGP: 2299 },
  { orderNo: "1050", title: "Duo Stone Ring — Gold Plated Sterling Silver Gemstone Ring for Women", variantTitle: "Green / 6", sku: "R00001-GR-6", quantity: 1, priceEGP: 1599 },
  { orderNo: "1051", title: "Mosaic Ring — Gold Plated Sterling Silver Ring with Colored Stones for Women", variantTitle: "6", sku: "R00002-6", quantity: 1, priceEGP: 2299 },
];

const db = new PrismaClient();

async function buildPhotoMap(prisma) {
  try {
    const products = await prisma.shopifyProductCache.findMany({
      select: { imageUrl: true, rawJson: true },
    });
    const map = new Map();
    for (const product of products) {
      if (!product.imageUrl) continue;
      const variants = product.rawJson?.variants;
      if (Array.isArray(variants)) {
        for (const v of variants) {
          if (v.sku) map.set(v.sku.toLowerCase(), product.imageUrl);
        }
      }
    }
    console.log(`Photo map: ${map.size} SKU entries`);
    return map;
  } catch (err) {
    console.warn("Photo map build failed:", err.message);
    return new Map();
  }
}

async function readWeightsFromSheets() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_STOCK_ID;
  if (!email || !key || !sheetId) {
    console.warn("Google creds not set — skipping weight lookup");
    return new Map();
  }
  try {
    const auth = new google.auth.JWT({
      email,
      key: key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const tabs = ["Inventory", "Cost", "Costs", "Products", "Stock", "Sheet1"];
    let rows = null;
    for (const tab of tabs) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${tab}!A1:Z300`,
        });
        if (res.data.values?.length > 1) { rows = res.data.values; console.log(`Weight sheet tab: ${tab}`); break; }
      } catch { /* try next */ }
    }
    if (!rows || rows.length < 2) { console.warn("No sheet rows for weights"); return new Map(); }
    const headers = rows[0].map((h) => String(h ?? "").toLowerCase().trim());
    const skuIdx = headers.findIndex((h) =>
      h === "sku" || h === "كود" || h === "كود المنتج" || h === "product code" ||
      h.includes("sku") || h.includes("كود")
    );
    const weightIdx = headers.findIndex((h) =>
      h.includes("weight") || h.includes("وزن") || h.includes("الوزن") ||
      h.includes("gram") || h.includes("جرام") || h.includes("غرام") ||
      h === "wt" || h === "gm" || h === "g (wt)"
    );
    if (skuIdx === -1 || weightIdx === -1) {
      console.warn(`Weight col not found. Headers: [${headers.join(" | ")}]`);
      return new Map();
    }
    const map = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sku = String(row[skuIdx] ?? "").trim();
      const w   = parseFloat(String(row[weightIdx] ?? "").trim());
      if (sku && !isNaN(w) && w > 0) map.set(sku.toLowerCase(), w);
    }
    console.log(`Weight map: ${map.size} SKU entries`);
    return map;
  } catch (err) {
    console.warn("Weight sheet read failed:", err.message);
    return new Map();
  }
}

// Weight per main SKU in grams — fallback when Google Sheets creds not set
const WEIGHT_BY_MAIN_SKU = {
  R00001: 2.38, R00002: 5.62, R00003: 3.79, R00004: 5.36,
  R00005: 1.60, R00006: 6.62, R00007: 2.20, R00008: 5.37,
  R00009: 4.85, R00010: 1.22, R00011: 2.66, R00012: 2.98,
  B00001: 6.34, B00002: 6.63, B00003: 8.29,
  E00001: 7.79, E00002: 5.78,
  N00001: 18.68,
};

function mainSkuWeight(sku) {
  if (!sku) return 0;
  const m = sku.match(/^([A-Z]\d{5})/);
  return m ? (WEIGHT_BY_MAIN_SKU[m[1]] ?? 0) : 0;
}

const COLOR_CODE_MAP = {
  P: "Pink", GR: "Green", Y: "Yellow", BL: "Blue",
  B: "Blue", G: "Gold", R: "Red",
};

function inferColors(sku) {
  if (!sku) return [];
  const colors = [];
  for (const part of sku.split("-")) {
    const color = COLOR_CODE_MAP[part.toUpperCase()];
    if (color && !colors.includes(color)) colors.push(color);
  }
  return colors;
}

function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("earring")) return "Earrings";
  if (t.includes("necklace")) return "Necklace";
  if (t.includes("bracelet") || t.includes("cuff")) return "Bracelet";
  if (t.includes("anklet")) return "Anklet";
  if (t.includes("set")) return "Set";
  if (t.includes("ring")) return "Ring";
  return "Other";
}

function extractSize(variantTitle) {
  if (!variantTitle) return null;
  const m = variantTitle.match(/\b(size\s*)?(\d+(?:\.\d+)?)\b/i);
  return m ? m[2] : null;
}

async function main() {
  console.log("Running inventory rebuild from static paid-order data...");

  const [photoMap, weightMap] = await Promise.all([
    buildPhotoMap(db),
    readWeightsFromSheets(),
  ]);

  let created = 0;
  let missingCost = 0;

  for (const item of LINE_ITEMS) {
    const isDefault = !item.variantTitle || item.variantTitle === "Default Title";
    const variantLabel = isDefault ? null : item.variantTitle;
    const nameFull = variantLabel ? `${item.title} (${variantLabel})` : item.title;
    const size = extractSize(variantLabel);
    const costEGP = item.sku && COST_BY_SKU[item.sku] != null ? COST_BY_SKU[item.sku] : null;
    if (costEGP == null) missingCost++;

    const skuLower = item.sku?.toLowerCase() ?? "";
    const photoUrl = skuLower ? (photoMap.get(skuLower) ?? null) : null;
    const weightG  = skuLower ? (weightMap.get(skuLower) || mainSkuWeight(item.sku)) : 0;

    await db.inventoryItem.create({
      data: {
        name: nameFull,
        sku: item.sku || null,
        category: inferCategory(nameFull),
        material: "Sterling Silver",
        weightG,
        colors: inferColors(item.sku),
        size: size ?? undefined,
        quantity: item.quantity,
        costEGP,
        priceEGP: item.priceEGP,
        status: "SOLD",
        orderNo: item.orderNo,
        photoUrl,
      },
    });
    created++;
  }

  console.log(`Done. Created ${created} SOLD items (${missingCost} without cost data) from static order data.`);
}

main()
  .catch((err) => { console.error("Rebuild failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
