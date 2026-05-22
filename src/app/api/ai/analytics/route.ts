export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { generateAnalyticsAnswer } from "@/lib/ai/agent";
import { z } from "zod";

const schema = z.object({ question: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const answer = await generateAnalyticsAnswer(parsed.data.question);
  return NextResponse.json({ answer });
}
