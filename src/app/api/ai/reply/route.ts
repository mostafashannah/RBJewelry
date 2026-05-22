export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { processInboundMessage } from "@/lib/ai/agent";
import { z } from "zod";

const schema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await processInboundMessage(parsed.data.conversationId, parsed.data.messageId);
  return NextResponse.json({ ok: true });
}
