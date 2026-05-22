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
    data: { source: "META", eventType: "instagram", payload, processed: false },
  });

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "messages") {
        await handleDM(change.value);
      } else if (change.field === "comments") {
        await handleComment(change.value);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleDM(value: Record<string, unknown>) {
  const sender = (value.sender as { id: string })?.id;
  const msg = value.message as { mid?: string; text?: string } | undefined;
  if (!sender || !msg?.text) return;

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform: Platform.INSTAGRAM_DM, externalId: sender } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    create: { platform: Platform.INSTAGRAM_DM, externalId: sender, unreadCount: 1 },
  });

  // Deduplicate
  if (msg.mid) {
    const exists = await db.message.findUnique({ where: { externalMsgId: msg.mid } });
    if (exists) return;
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: Direction.INBOUND,
      body: msg.text,
      externalMsgId: msg.mid ?? null,
    },
  });

  // Async AI reply (fire and forget — don't block webhook response)
  processInboundMessage(conversation.id, message.id).catch(console.error);
}

async function handleComment(value: Record<string, unknown>) {
  const commentId = value.comment_id as string;
  const mediaId = value.media_id as string;
  const fromId = (value.from as { id: string })?.id ?? "";
  const text = value.text as string;

  if (!commentId || !text) return;

  await db.instagramComment.upsert({
    where: { commentId },
    update: {},
    create: { commentId, mediaId, fromUserId: fromId, body: text },
  });

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform: Platform.INSTAGRAM_COMMENT, externalId: commentId } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    create: { platform: Platform.INSTAGRAM_COMMENT, externalId: commentId, unreadCount: 1 },
  });

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: Direction.INBOUND,
      body: text,
      externalMsgId: commentId,
    },
  });

  processInboundMessage(conversation.id, message.id).catch(console.error);
}
