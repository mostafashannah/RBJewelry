export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Direction } from "@prisma/client";
import { verifySocialFlowSignature } from "@/lib/socialflow/verify";
import { socialFlowChannelToPlatform } from "@/lib/socialflow/channel";
import { processInboundMessage } from "@/lib/ai/agent";
import { sendPushNotification } from "@/lib/push";

interface SocialFlowThreadEntry {
  direction: "in" | "out";
  message_text: string;
  attachment_url: string | null;
  created_at: string;
}

function parseSocialFlowDate(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

// Mirrors the convention used by the direct Meta webhooks (instagram/facebook/whatsapp routes):
// keep real text as-is, otherwise fall back to a placeholder body when an image is attached.
function resolveBody(text: string | null | undefined, attachmentUrl: string | null | undefined): string {
  const trimmed = text?.trim();
  if (trimmed && trimmed !== "[Image]") return trimmed;
  return attachmentUrl ? "أرسل العميل صورة / Customer sent a photo" : (trimmed ?? "");
}

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-socialflow-signature");

  if (!verifySocialFlowSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf-8"));
  const {
    channel,
    customer_id: customerId,
    customer_name: customerName,
    external_id: externalId,
    thread,
  }: {
    channel: string;
    customer_id: string;
    customer_name: string | null;
    external_id: string | null;
    thread: SocialFlowThreadEntry[];
  } = payload;

  const platform = socialFlowChannelToPlatform(channel);
  if (!platform || !customerId) {
    return NextResponse.json({ error: "Unsupported channel or missing customer_id" }, { status: 400 });
  }

  const existing = await db.conversation.findUnique({
    where: { platform_externalId: { platform, externalId: customerId } },
  });

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform, externalId: customerId } },
    update: {
      viaSocialFlow: true,
      unreadCount: { increment: 1 },
      lastMessageAt: new Date(),
      ...(customerName ? { displayName: customerName } : {}),
    },
    create: {
      platform,
      externalId: customerId,
      displayName: customerName ?? null,
      viaSocialFlow: true,
      unreadCount: 1,
    },
  });

  let newMessage: { id: string; body: string } | null = null;

  if (Array.isArray(thread) && thread.length > 0) {
    if (!existing) {
      // Brand-new conversation — seed the whole thread for context
      for (let i = 0; i < thread.length; i++) {
        const entry = thread[i];
        const isLast = i === thread.length - 1;
        const created = await db.message.create({
          data: {
            conversationId: conversation.id,
            direction: entry.direction === "out" ? Direction.OUTBOUND : Direction.INBOUND,
            body: resolveBody(entry.message_text, entry.attachment_url),
            mediaUrl: entry.attachment_url ?? undefined,
            externalMsgId: isLast && externalId ? externalId : undefined,
            sentAt: parseSocialFlowDate(entry.created_at),
          },
        });
        if (isLast && entry.direction === "in") newMessage = created;
      }
    } else {
      // Existing conversation — we already have the history, just record the newest entry
      const last = thread[thread.length - 1];
      if (last.direction === "in") {
        newMessage = await db.message.create({
          data: {
            conversationId: conversation.id,
            direction: Direction.INBOUND,
            body: resolveBody(last.message_text, last.attachment_url),
            mediaUrl: last.attachment_url ?? undefined,
            externalMsgId: externalId ?? undefined,
            sentAt: parseSocialFlowDate(last.created_at),
          },
        });
      }
    }
  }

  if (newMessage) {
    processInboundMessage(conversation.id, newMessage.id).catch(console.error);
    sendPushNotification("New message", newMessage.body, "/inbox").catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
