export const dynamic = "force-dynamic";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySocialFlowSignature } from "@/lib/socialflow/verify";
import { socialFlowChannelToPlatform, isCommentChannel } from "@/lib/socialflow/channel";
import { processInboundMessage } from "@/lib/ai/agent";
import { sendPushNotification } from "@/lib/push";
import { Direction } from "@prisma/client";

interface ThreadEntry {
  direction: "in" | "out";
  message_text: string;
  created_at: string;
}

interface SocialFlowPayload {
  client_id: string;
  client_name: string;
  channel: string;
  customer_id: string;
  customer_name: string | null;
  external_id: string | null;
  post_caption: string | null;
  thread: ThreadEntry[];
  sent_at: string;
}

export async function POST(req: NextRequest) {
  const ab = await req.arrayBuffer();
  const rawBody = Buffer.from(ab);
  const signature = req.headers.get("x-socialflow-signature") ?? "";

  if (process.env.NODE_ENV === "production" && !verifySocialFlowSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: SocialFlowPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform = socialFlowChannelToPlatform(payload.channel);
  if (!platform) {
    return NextResponse.json({ error: `Unknown channel: ${payload.channel}` }, { status: 400 });
  }

  const isComment = isCommentChannel(payload.channel);
  const externalId = isComment ? payload.external_id : payload.customer_id;
  if (!externalId) {
    return NextResponse.json({ error: "Missing customer_id/external_id" }, { status: 400 });
  }

  const lastInbound = [...(payload.thread ?? [])].reverse().find((t) => t.direction === "in");
  const body = lastInbound?.message_text ?? "";
  if (!body) {
    return NextResponse.json({ ok: true, skipped: "no inbound message in thread" });
  }

  const externalMsgId = crypto
    .createHash("sha256")
    .update(`${payload.client_id}:${payload.channel}:${externalId}:${payload.sent_at}`)
    .digest("hex")
    .slice(0, 32);

  const exists = await db.message.findUnique({ where: { externalMsgId } });
  if (exists) {
    return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  const conversation = await db.conversation.upsert({
    where: { platform_externalId: { platform, externalId } },
    update: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
      viaSocialFlow: true,
      ...(payload.customer_name ? { displayName: payload.customer_name } : {}),
    },
    create: {
      platform,
      externalId,
      displayName: payload.customer_name,
      unreadCount: 1,
      viaSocialFlow: true,
    },
  });

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: Direction.INBOUND,
      body,
      externalMsgId,
    },
  });

  processInboundMessage(conversation.id, message.id).catch(console.error);
  sendPushNotification("New message", body, "/inbox").catch(() => {});

  return NextResponse.json({ ok: true });
}
