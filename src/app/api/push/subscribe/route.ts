export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sub = await req.json();
  if (!sub.endpoint) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { keys: sub.keys },
    create: { endpoint: sub.endpoint, keys: sub.keys },
  });

  return NextResponse.json({ ok: true });
}
