export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const TROY_OZ_PER_GRAM = 1 / 31.1035;
const SILVER_PURITY = 0.925;

async function fetchUsdEgpRate(): Promise<number | null> {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDEGP%3DX&fields=regularMarketPrice",
      { headers: { "User-Agent": UA, "Accept": "application/json" } }
    );
    if (r.ok) {
      const data = await r.json() as { quoteResponse?: { result?: { regularMarketPrice?: number }[] } };
      const rate = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (rate && rate > 0) return rate;
    }
  } catch { /* fail */ }
  return null;
}

async function fetchSilverPrice(): Promise<number | null> {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";

  // Attempt 1: metals.live — no auth required
  try {
    const r = await fetch("https://api.metals.live/v1/spot/silver", {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });
    if (r.ok) {
      const data = await r.json() as { silver?: number }[];
      const price = Array.isArray(data) ? data[0]?.silver : (data as Record<string,number>)?.silver;
      if (price && price > 0) return price;
    }
  } catch { /* try next */ }

  // Attempt 2: Yahoo Finance v8 — SI=F (silver futures, USD/troy oz)
  try {
    const r = await fetch(
      "https://query2.finance.yahoo.com/v8/finance/chart/SI%3DF?interval=1d&range=1d",
      { headers: { "User-Agent": UA, "Accept": "application/json", "Origin": "https://finance.yahoo.com", "Referer": "https://finance.yahoo.com/" } }
    );
    if (r.ok) {
      const data = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } };
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) return price;
    }
  } catch { /* try next */ }

  // Attempt 3: Yahoo Finance v7 quote
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=SI%3DF&fields=regularMarketPrice",
      { headers: { "User-Agent": UA, "Accept": "application/json" } }
    );
    if (r.ok) {
      const data = await r.json() as { quoteResponse?: { result?: { regularMarketPrice?: number }[] } };
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price && price > 0) return price;
    }
  } catch { /* fail */ }

  return null;
}

export async function GET() {
  const [items, soldItems, pricePerOz, usdEgpRate] = await Promise.all([
    db.inventoryItem.findMany({
      where: { status: "IN_STOCK", material: { contains: "Silver" } },
      select: { weightG: true, quantity: true, priceEGP: true },
    }),
    db.inventoryItem.findMany({
      where: { status: "SOLD" },
      select: { weightG: true, quantity: true, costEGP: true, priceEGP: true },
    }),
    fetchSilverPrice(),
    fetchUsdEgpRate(),
  ]);

  const totalWeightG = items.reduce((s, i) => s + i.weightG * i.quantity, 0);
  const pureSilverG = totalWeightG * SILVER_PURITY;
  const totalListingValueEGP = items
    .filter((i) => i.priceEGP)
    .reduce((s, i) => s + (i.priceEGP ?? 0) * i.quantity, 0);

  const pricePerGram = pricePerOz ? pricePerOz * TROY_OZ_PER_GRAM : null;
  const silverValueUSD = pricePerGram ? pureSilverG * pricePerGram : null;

  const soldTotalWeightG = soldItems.reduce((s, i) => s + i.weightG * i.quantity, 0);
  const soldTotalCostEGP = soldItems
    .filter((i) => i.costEGP != null)
    .reduce((s, i) => s + (i.costEGP ?? 0) * i.quantity, 0);
  const soldTotalPriceEGP = soldItems
    .filter((i) => i.priceEGP != null)
    .reduce((s, i) => s + (i.priceEGP ?? 0) * i.quantity, 0);

  // Metal cost = weight × 92.5% purity × spot price per gram (USD) × USD/EGP rate
  const soldMetalCostEGP = (pricePerGram && usdEgpRate)
    ? soldTotalWeightG * SILVER_PURITY * pricePerGram * usdEgpRate
    : null;

  return NextResponse.json({
    totalItems: items.length,
    totalWeightG: Math.round(totalWeightG * 100) / 100,
    pureSilverG: Math.round(pureSilverG * 100) / 100,
    totalListingValueEGP,
    spot: pricePerOz
      ? {
          pricePerOzUSD: Math.round(pricePerOz * 100) / 100,
          pricePerGramUSD: Math.round((pricePerGram ?? 0) * 1000) / 1000,
          silverValueUSD: Math.round((silverValueUSD ?? 0) * 100) / 100,
        }
      : null,
    usdEgpRate,
    soldItems: soldItems.length,
    soldTotalWeightG: Math.round(soldTotalWeightG * 100) / 100,
    soldTotalCostEGP: Math.round(soldTotalCostEGP),
    soldTotalPriceEGP: Math.round(soldTotalPriceEGP),
    soldMetalCostEGP: soldMetalCostEGP != null ? Math.round(soldMetalCostEGP) : null,
  });
}
