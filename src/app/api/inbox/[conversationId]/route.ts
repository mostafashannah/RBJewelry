export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  const conversation = await db.conversation.findUnique({
    where: { id: params.conversationId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conversation);
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "SNOOZED"]).optional(),
  unreadCount: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { conversationId: string } }) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await db.conversation.update({
    where: { id: params.conversationId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}
