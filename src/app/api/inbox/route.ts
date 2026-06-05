export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ConversationStatus, Platform } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform") as Platform | null;
    const status = (searchParams.get("status") as ConversationStatus) ?? "OPEN";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = 30;

    const where: Record<string, unknown> = { status };
    if (platform) where.platform = platform;

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } },
      }),
      db.conversation.count({ where }),
    ]);

    return NextResponse.json({ conversations, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[inbox] GET failed:", msg);
    return NextResponse.json({ error: msg, conversations: [], total: 0, page: 1, pages: 0 }, { status: 500 });
  }
}
