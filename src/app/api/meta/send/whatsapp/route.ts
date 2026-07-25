export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/meta/whatsapp";
import { db } from "@/lib/db";
import { Direction } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { conversationId, message } = parsed.data;

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sendWhatsAppMessage(conversation.externalId, message);

  await db.message.create({
    data: { conversationId, direction: Direction.OUTBOUND, body: message, isAiGenerated: false },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
