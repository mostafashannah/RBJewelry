export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendFacebookDM, replyToFacebookComment } from "@/lib/meta/facebook";
import { sendSocialFlowReply } from "@/lib/socialflow/send";
import { Direction, Platform } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();
  if (!conversationId || !message) {
    return NextResponse.json({ error: "conversationId and message required" }, { status: 400 });
  }

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  try {
    if (conversation.viaSocialFlow) {
      let commentExternalId: string | null = null;
      if (conversation.platform === Platform.FACEBOOK_COMMENT) {
        const lastComment = await db.message.findFirst({
          where: { conversationId, externalMsgId: { not: null } },
          orderBy: { sentAt: "desc" },
        });
        commentExternalId = lastComment?.externalMsgId ?? null;
      }
      await sendSocialFlowReply({
        channel: conversation.platform === Platform.FACEBOOK_COMMENT ? "fb_comment" : "messenger",
        recipientId: conversation.platform === Platform.FACEBOOK_DM ? conversation.externalId : null,
        externalId: commentExternalId,
        message,
      });
    } else if (conversation.platform === Platform.FACEBOOK_DM) {
      await sendFacebookDM(conversation.externalId, message);
    } else if (conversation.platform === Platform.FACEBOOK_COMMENT) {
      await replyToFacebookComment(conversation.externalId, message);
    } else {
      return NextResponse.json({ error: "Not a Facebook conversation" }, { status: 400 });
    }

    const msg = await db.message.create({
      data: {
        conversationId,
        direction: Direction.OUTBOUND,
        body: message,
        deliveredAt: new Date(),
      },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ ok: true, messageId: msg.id });
  } catch (err) {
    console.error("Facebook send error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
