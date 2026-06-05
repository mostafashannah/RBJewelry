export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const TROY_OZ_PER_GRAM = 1 / 31.1035;
const SILVER_PURITY = 0.925; // 925 sterling silver

async function fetchSilverSpotPrice(): Promise<{ pricePerOz: number; pricePerGram: number } | null> {
  try {
    // Yahoo Finance silver spot price (XAGUSD=X)
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/XAGUSD%3DX?interval=1d&range=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } }
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;
    if (!price) return null;
    return {
      pricePerOz: price,
      pricePerGram: price * TROY_OZ_PER_GRAM,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [items, spot] = await Promise.all([
    db.inventoryItem.findMany({
      where: { status: "IN_STOCK", material: { contains: "Silver" } },
      select: { weightG: true, quantity: true, priceEGP: true, name: true },
    }),
    fetchSilverSpotPrice(),
  ]);

  const totalWeightG = items.reduce((s, i) => s + i.weightG * i.quantity, 0);
  const pureSilverG = totalWeightG * SILVER_PURITY;
  const totalListingValueEGP = items
    .filter((i) => i.priceEGP)
    .reduce((s, i) => s + (i.priceEGP ?? 0) * i.quantity, 0);

  const silverValueUSD = spot ? pureSilverG * spot.pricePerGram : null;

  return NextResponse.json({
    totalItems: items.length,
    totalWeightG: Math.round(totalWeightG * 100) / 100,
    pureSilverG: Math.round(pureSilverG * 100) / 100,
    totalListingValueEGP,
    spot: spot
      ? {
          pricePerOzUSD: Math.round(spot.pricePerOz * 100) / 100,
          pricePerGramUSD: Math.round(spot.pricePerGram * 1000) / 1000,
          silverValueUSD: Math.round((silverValueUSD ?? 0) * 100) / 100,
        }
      : null,
  });
}
