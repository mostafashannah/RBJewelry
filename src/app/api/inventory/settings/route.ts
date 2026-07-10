export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const DEFAULT_COST_RULES = {
  metal: { markupPct: 10 },
  manufacturing: { mode: "percentage" as const, pct: 10, perGram: 5 },
  plating: { Ring: 15, Earrings: 20, Necklace: 25, Bracelet: 20, Anklet: 15, Set: 30, Other: 10 },
  packaging: { fixed: 75 },
};

export async function GET() {
  const record = await db.appSettings.findUnique({ where: { id: "singleton" } });
  const rules = (record?.costRules as typeof DEFAULT_COST_RULES | null) ?? DEFAULT_COST_RULES;
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const record = await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", costRules: body },
    update: { costRules: body },
  });
  return NextResponse.json(record.costRules);
}
