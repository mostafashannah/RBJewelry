export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Platform } from "@prisma/client";

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

// POST /api/admin/webhook-events — backfill display names for all conversations missing them
export async function POST() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_FACEBOOK_PAGE_ID;
  if (!token || !pageId) return NextResponse.json({ error: "No page token or page ID" }, { status: 500 });

  // Build a map of PSID -> name from the Page conversations API (covers all FB users)
  const fbNameMap = new Map<string, { name: string; pic?: string }>();
  const fbRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=participants&limit=100&access_token=${token}`
  );
  const fbData = await fbRes.json() as { data?: { participants?: { data?: { id: string; name?: string; profile_pic?: string }[] } }[] };
  for (const convo of fbData.data ?? []) {
    for (const p of convo.participants?.data ?? []) {
      if (p.id !== pageId && p.name) {
        fbNameMap.set(p.id, { name: p.name, pic: p.profile_pic });
      }
    }
  }

  // Build a map from IG conversations API (covers testers / Advanced Access users)
  const igNameMap = new Map<string, { name: string; pic?: string }>();
  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/conversations?platform=instagram&fields=participants&limit=100&access_token=${token}`
  );
  const igData = await igRes.json() as { data?: { participants?: { data?: { id: string; username?: string; name?: string; profile_pic?: string }[] } }[] };
  const igAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  for (const convo of igData.data ?? []) {
    for (const p of convo.participants?.data ?? []) {
      if (p.id !== igAccountId && (p.username || p.name)) {
        const displayName = p.username ? `@${p.username}` : p.name!;
        igNameMap.set(p.id, { name: displayName, pic: p.profile_pic });
      }
    }
  }

  const convs = await db.conversation.findMany({ where: { displayName: null } });
  const results: { id: string; platform: string; externalId: string; displayName: string | null }[] = [];

  for (const conv of convs) {
    let entry: { name: string; pic?: string } | undefined;
    if (conv.platform === Platform.FACEBOOK_DM || conv.platform === Platform.FACEBOOK_COMMENT) {
      entry = fbNameMap.get(conv.externalId);
    } else if (conv.platform === Platform.INSTAGRAM_DM) {
      entry = igNameMap.get(conv.externalId);
    }

    if (entry) {
      await db.conversation.update({
        where: { id: conv.id },
        data: { displayName: entry.name, ...(entry.pic ? { avatarUrl: entry.pic } : {}) },
      });
    }
    results.push({ id: conv.id, platform: conv.platform, externalId: conv.externalId, displayName: entry?.name ?? null });
  }

  return NextResponse.json({ backfilled: results.filter(r => r.displayName).length, total: results.length, results });
}
