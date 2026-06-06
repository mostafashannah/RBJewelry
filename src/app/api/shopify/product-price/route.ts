export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name) return NextResponse.json({ products: [] });

  const products = await db.shopifyProductCache.findMany({
    where: { title: { contains: name, mode: "insensitive" } },
    select: { id: true, title: true, priceMin: true, priceMax: true, imageUrl: true },
    take: 5,
  });
  return NextResponse.json({ products });
}
