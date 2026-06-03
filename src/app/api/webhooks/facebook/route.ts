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

  if (process.env.NODE_ENV === "production" && !verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf-8"));

  // Instagram events can arrive at this endpoint when both products share
  // the same webhook URL in Meta Developer Console.
  // Route them to the Instagram handler so they're saved under INSTAGRAM_DM.
  if (payload.object === "instagram") {
    await db.webhookEvent.create({
      data: { source: "META", eventType: "instagram", payload, processed: false },
    });
    for (const entry of payload.entry ?? []) {
      for (const msg of entry.messaging ?? []) {
        if (msg.message && !msg.message.is_echo) {
          await handleInstagramDM(msg);
        }
      }
      for (const change of entry.changes ?? []) {
        if (change.field === "messages") {
          const val = change.value as Record<string, unknown>;
          if (val?.message && !(val.message as Record<string, unknown>)?.is_echo) {
            await handleInstagramDM(val);
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  await db.webhookEvent.create({
    data: { source: "META", eventType: "facebook", payload, processed: false },
  });

  for (const entry of payload.entry ?? []) {
    // Facebook Messenger DMs
    for (const msg of entry.messaging ?? []) {
      if (msg.message && !msg.message.is_echo) {
        await handleFacebookDM(msg);
      }
    }
    // Facebook Page comments
    for (const change of entry.changes ?? []) {
      if (change.field === "feed" && change.value?.item === "comment") {
        await handleFacebookComment(change.value);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleFacebookDM(value: Record<string, unknown>) {
  const sender = (value.sender as { id: string })?.id;
  const msg = value.message as {
    mid?: string;
    text?: string;
    attachments?: { type: string; payload?: { url?: string } }[];
  } | undefined;

  const pageId = process.env.META_PAGE_ID ?? process.env.META_FACEBOOK_PAGE_ID;
  if (!sender || sender === pageId) return;

  const imageUrl = msg?.attachments?.find((a) => a.type === "image")?.payload?.url ?? null;
  const body = msg?.text ?? (imageUrl ? "أرسل العميل صورة / Customer sent a photo" : null);
  if (!body && !imageUrl) return;

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform: Platform.FACEBOOK_DM, externalId: sender } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    create: { platform: Platform.FACEBOOK_DM, externalId: sender, unreadCount: 1 },
  });

  if (msg?.mid) {
    const exists = await db.message.findUnique({ where: { externalMsgId: msg.mid } });
    if (exists) return;
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: Direction.INBOUND,
      body: body ?? "",
      externalMsgId: msg?.mid ?? null,
      mediaUrl: imageUrl,
    },
  });

  processInboundMessage(conversation.id, message.id).catch(console.error);
}

async function handleInstagramDM(value: Record<string, unknown>) {
  const sender = (value.sender as { id: string })?.id;
  const msg = value.message as {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type: string; payload?: { url?: string } }[];
  } | undefined;
  if (!sender || msg?.is_echo) return;

  const imageUrl = msg?.attachments?.find((a) => a.type === "image")?.payload?.url ?? null;
  const body = msg?.text ?? (imageUrl ? "أرسل العميل صورة / Customer sent a photo" : null);
  if (!body && !imageUrl) return;

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform: Platform.INSTAGRAM_DM, externalId: sender } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    create: { platform: Platform.INSTAGRAM_DM, externalId: sender, unreadCount: 1 },
  });

  if (msg?.mid) {
    const exists = await db.message.findUnique({ where: { externalMsgId: msg.mid } });
    if (exists) return;
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: Direction.INBOUND,
      body: body ?? "",
      externalMsgId: msg?.mid ?? null,
      mediaUrl: imageUrl,
    },
  });

  processInboundMessage(conversation.id, message.id).catch(console.error);
}

async function handleFacebookComment(value: Record<string, unknown>) {
  const commentId = value.comment_id as string ?? value.id as string;
  const fromId = (value.from as { id: string })?.id ?? "";
  const text = value.message as string;

  if (!commentId || !text) return;

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform: Platform.FACEBOOK_COMMENT, externalId: commentId } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    create: {
      platform: Platform.FACEBOOK_COMMENT,
      externalId: commentId,
      displayName: fromId || undefined,
      unreadCount: 1,
    },
  });

  const exists = await db.message.findUnique({ where: { externalMsgId: commentId } });
  if (exists) return;

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
