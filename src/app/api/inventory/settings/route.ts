export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_COST_RULES } from "@/lib/cost-settings";

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
