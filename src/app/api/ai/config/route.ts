export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Platform } from "@prisma/client";
import { z } from "zod";

export async function GET() {
  let config = await db.aiConfig.findFirst();
  if (!config) {
    config = await db.aiConfig.create({
      data: {
        systemPrompt: "You are Rania, the friendly assistant for RB Jewelry.",
        autoReplyEnabled: true,
        platforms: [Platform.INSTAGRAM_DM, Platform.WHATSAPP],
        maxTokens: 400,
        temperature: 0.7,
      },
    });
  }
  return NextResponse.json(config);
}

const schema = z.object({
  systemPrompt: z.string().optional(),
  autoReplyEnabled: z.boolean().optional(),
  platforms: z.array(z.nativeEnum(Platform)).optional(),
  maxTokens: z.number().int().min(100).max(1000).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.aiConfig.findFirst();
  if (existing) {
    const updated = await db.aiConfig.update({ where: { id: existing.id }, data: parsed.data });
    return NextResponse.json(updated);
  }
  const created = await db.aiConfig.create({ data: { ...parsed.data, systemPrompt: parsed.data.systemPrompt ?? "" } });
  return NextResponse.json(created);
}
