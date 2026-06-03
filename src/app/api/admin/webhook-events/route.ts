export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [events, conversations] = await Promise.all([
    db.webhookEvent.findMany({
      where: { eventType: "instagram" },
      orderBy: { id: "desc" },
      take: 3,
    }),
    db.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 10,
      include: { messages: { orderBy: { sentAt: "desc" }, take: 2 } },
    }),
  ]);

  const convSummary = conversations.map((c) => ({
    id: c.id,
    platform: c.platform,
    status: c.status,
    externalId: c.externalId,
    lastMessageAt: c.lastMessageAt,
    unreadCount: c.unreadCount,
    messageCount: c.messages.length,
    lastMsgDirection: c.messages[0]?.direction ?? null,
    lastMsgBody: c.messages[0]?.body?.slice(0, 60) ?? null,
  }));

  return NextResponse.json({
    recentInstagramPayloads: events.map((e) => ({ id: e.id, payload: e.payload })),
    recentConversations: convSummary,
  });
}
