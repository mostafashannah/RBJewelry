export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET() {
  const reports = await db.dailyReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ reports });
}

export async function POST() {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const reportDate = now.toISOString().slice(0, 10);

  const conversations = await db.conversation.findMany({
    where: { lastMessageAt: { gte: since } },
    include: {
      messages: {
        where: { sentAt: { gte: since } },
        orderBy: { sentAt: "asc" },
      },
    },
  });

  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const inbound = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.direction === "INBOUND").length,
    0
  );
  const aiReplies = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.isAiGenerated).length,
    0
  );

  // Build a text dump of all conversations for Claude to analyse
  const convoText = conversations.map((c) => {
    const msgs = c.messages
      .filter((m) => !m.body.startsWith("[Image]"))
      .map((m) => `  [${m.direction === "INBOUND" ? "Customer" : "Bot"}]: ${m.body}`)
      .join("\n");
    return `--- Conversation ${c.id} (${c.platform}) ---\n${msgs}`;
  }).join("\n\n");

  const stats = {
    totalConversations: conversations.length,
    totalMessages,
    inboundMessages: inbound,
    aiReplies,
    date: reportDate,
  };

  if (!convoText.trim()) {
    const empty = await db.dailyReport.upsert({
      where: { reportDate },
      create: {
        reportDate,
        summary: "No conversations in the last 24 hours.",
        stats,
        unanswered: [],
        topTopics: [],
      },
      update: {
        summary: "No conversations in the last 24 hours.",
        stats,
        unanswered: [],
        topTopics: [],
      },
    });
    return NextResponse.json({ report: empty });
  }

  const analysisPrompt = `You are analysing customer service conversations for RB Jewelry, an Egyptian handmade sterling silver jewelry brand.

Review the following conversations from the past 24 hours and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence plain-text summary of the day",
  "unanswered": [
    {
      "conversationId": "string",
      "question": "the customer's exact question or topic",
      "botReply": "what the bot said (brief)",
      "reason": "why this was a weak or unanswered response"
    }
  ],
  "topTopics": [
    { "topic": "topic name", "count": number }
  ]
}

Rules:
- unanswered: flag questions where the bot said it can't help, redirected to WhatsApp, gave a vague answer, or didn't actually address what was asked. Max 10 items.
- topTopics: group messages by theme (e.g. "Sizing", "Order status", "Product inquiry", "Price", "Delivery", "Custom orders"). Max 8 items.
- Return ONLY valid JSON, no markdown, no explanation.

CONVERSATIONS:
${convoText.slice(0, 15000)}`;

  let analysis: { summary: string; unanswered: unknown[]; topTopics: unknown[] } = {
    summary: "",
    unanswered: [],
    topTopics: [],
  };

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: analysisPrompt }],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
    analysis = JSON.parse(text);
  } catch (err) {
    console.error("Report analysis failed:", err);
    analysis.summary = "Analysis failed — check server logs.";
  }

  const report = await db.dailyReport.upsert({
    where: { reportDate },
    create: {
      reportDate,
      summary: analysis.summary,
      stats,
      unanswered: (analysis.unanswered ?? []) as object[],
      topTopics: (analysis.topTopics ?? []) as object[],
    },
    update: {
      summary: analysis.summary,
      stats,
      unanswered: (analysis.unanswered ?? []) as object[],
      topTopics: (analysis.topTopics ?? []) as object[],
    },
  });

  return NextResponse.json({ report });
}
