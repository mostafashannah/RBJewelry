import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getProductContextString } from "./product-context";
import { buildSystemPrompt } from "./system-prompt";
import { sendInstagramDM, replyToInstagramComment } from "@/lib/meta/instagram";
import { sendWhatsAppMessage } from "@/lib/meta/whatsapp";
import { sendFacebookDM, replyToFacebookComment } from "@/lib/meta/facebook";
import { Platform, Direction } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function processInboundMessage(conversationId: string, inboundMessageId: string) {
  const startMs = Date.now();

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "asc" }, take: 20 } },
  });
  if (!conversation) return;

  const config = await db.aiConfig.findFirst();
  if (!config?.autoReplyEnabled) return;
  if (!config.platforms.includes(conversation.platform)) return;

  const productContext = await getProductContextString();
  const systemPrompt = buildSystemPrompt(productContext);

  const messages: Anthropic.MessageParam[] = conversation.messages
    .filter((m) => m.id !== inboundMessageId || m.direction === "INBOUND")
    .map((m) => ({
      role: m.direction === Direction.INBOUND ? "user" : "assistant",
      content: m.body,
    }));

  const inboundMsg = conversation.messages.find((m) => m.id === inboundMessageId);
  if (!inboundMsg) return;

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: inboundMsg.body });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: config.maxTokens ?? 400,
    system: systemPrompt,
    messages,
  });

  const replyText = response.content[0].type === "text" ? response.content[0].text : "";
  if (!replyText) return;

  // Save outbound message
  const outbound = await db.message.create({
    data: {
      conversationId,
      direction: Direction.OUTBOUND,
      body: replyText,
      isAiGenerated: true,
    },
  });

  // Save AI reply audit record
  await db.aiReply.create({
    data: {
      conversationId,
      messageId: outbound.id,
      prompt: systemPrompt,
      rawResponse: replyText,
      finalReply: replyText,
      model: "claude-sonnet-4-6",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      processingMs: Date.now() - startMs,
    },
  });

  // Send reply via appropriate platform
  try {
    if (conversation.platform === Platform.INSTAGRAM_DM) {
      await sendInstagramDM(conversation.externalId, replyText);
    } else if (conversation.platform === Platform.INSTAGRAM_COMMENT) {
      await replyToInstagramComment(conversation.externalId, replyText);
    } else if (conversation.platform === Platform.WHATSAPP) {
      await sendWhatsAppMessage(conversation.externalId, replyText);
    } else if (conversation.platform === Platform.FACEBOOK_DM) {
      await sendFacebookDM(conversation.externalId, replyText);
    } else if (conversation.platform === Platform.FACEBOOK_COMMENT) {
      await replyToFacebookComment(conversation.externalId, replyText);
    }

    await db.message.update({
      where: { id: outbound.id },
      data: { deliveredAt: new Date() },
    });
  } catch (err) {
    console.error("Failed to send AI reply:", err);
  }

  // Update conversation metadata
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unreadCount: 0 },
  });
}

export async function generateAnalyticsAnswer(question: string): Promise<string> {
  const productContext = await getProductContextString();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You are a business analytics assistant for RB Jewelry, an Egyptian jewelry brand.
Answer business questions using the data provided. Be concise and actionable.
Current product catalog: ${productContext}`,
    messages: [{ role: "user", content: question }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
