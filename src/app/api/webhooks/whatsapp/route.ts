export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMetaSignature, verifyWebhookToken } from "@/lib/meta/webhook-verify";
import { processInboundMessage } from "@/lib/ai/agent";
import { Platform, Direction } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && verifyWebhookToken(token)) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const ab = await req.arrayBuffer();
  const rawBody = Buffer.from(ab);
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf-8"));

  await db.webhookEvent.create({
    data: { source: "META", eventType: "whatsapp", payload, processed: false },
  });

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const val = change.value as {
        messages?: { id: string; from: string; type: string; text?: { body: string } }[];
        contacts?: { wa_id: string; profile: { name: string } }[];
      };

      const contacts = val.contacts ?? [];
      for (const msg of val.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const contact = contacts.find((c) => c.wa_id === msg.from);

        const conversation = await db.conversation.upsert({
          where: { platform_externalId: { platform: Platform.WHATSAPP, externalId: msg.from } },
          update: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            displayName: contact?.profile?.name ?? undefined,
          },
          create: {
            platform: Platform.WHATSAPP,
            externalId: msg.from,
            displayName: contact?.profile?.name ?? null,
            unreadCount: 1,
          },
        });

        const exists = await db.message.findUnique({ where: { externalMsgId: msg.id } });
        if (exists) continue;

        const message = await db.message.create({
          data: {
            conversationId: conversation.id,
            direction: Direction.INBOUND,
            body: msg.text.body,
            externalMsgId: msg.id,
          },
        });

        processInboundMessage(conversation.id, message.id).catch(console.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
