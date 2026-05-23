import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getProductContextString } from "./product-context";
import { buildSystemPrompt, CORE_RULES } from "./system-prompt";
import { sendInstagramDM, sendInstagramImage, replyToInstagramComment } from "@/lib/meta/instagram";
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/meta/whatsapp";
import { sendFacebookDM, sendFacebookImage, replyToFacebookComment } from "@/lib/meta/facebook";
import { resolveWhatsAppMediaUrl, downloadAsBase64 } from "@/lib/meta/media";
import { Platform, Direction } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Tool definition — lets the AI send a product photo
const TOOLS: Anthropic.Tool[] = [
  {
    name: "send_product_image",
    description:
      "Send a product photo to the customer. Use this when a customer asks to see a product, requests photos, or when showing the product would help them decide. Only call this for DM platforms (not comments).",
    input_schema: {
      type: "object" as const,
      properties: {
        product_name: {
          type: "string",
          description: "The name or partial name of the product to show (e.g. 'Wave Ring', 'Trio Stone')",
        },
        caption: {
          type: "string",
          description: "A short caption to send with the image (price, sizes, one-liner). Max 100 chars.",
        },
      },
      required: ["product_name"],
    },
  },
];

async function findProductImage(productName: string): Promise<{ imageUrl: string; title: string; price: string } | null> {
  const name = productName.toLowerCase();
  const products = await db.shopifyProductCache.findMany({ where: { available: true } });
  const match = products.find((p) => p.title.toLowerCase().includes(name)) ?? products[0];
  if (!match?.imageUrl) return null;
  const price = match.priceMin === match.priceMax
    ? `${match.priceMin} EGP`
    : `${match.priceMin}–${match.priceMax} EGP`;
  return { imageUrl: match.imageUrl, title: match.title, price };
}

async function sendImage(platform: Platform, externalId: string, imageUrl: string, caption: string) {
  if (platform === Platform.WHATSAPP) {
    await sendWhatsAppImage(externalId, imageUrl, caption);
  } else if (platform === Platform.INSTAGRAM_DM) {
    await sendInstagramImage(externalId, imageUrl);
    if (caption) await sendInstagramDM(externalId, caption);
  } else if (platform === Platform.FACEBOOK_DM) {
    await sendFacebookImage(externalId, imageUrl, caption);
  }
  // Comments don't support images — silently skip
}

export async function processInboundMessage(conversationId: string, inboundMessageId: string) {
  const startMs = Date.now();

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "asc" }, take: 20 } },
  });
  if (!conversation) return;

  const config = await db.aiConfig.findFirst();
  if (!config?.autoReplyEnabled) {
    console.log("[AI] Auto-reply disabled in config");
    return;
  }
  if (!config.platforms.includes(conversation.platform)) {
    console.log(`[AI] Platform ${conversation.platform} not in enabled list:`, config.platforms);
    return;
  }

  const productContext = await getProductContextString();
  // Always use DB prompt if set, otherwise use the default. Always append CORE_RULES and product context.
  const basePrompt = config.systemPrompt || buildSystemPrompt(productContext);
  const systemPrompt = [basePrompt, CORE_RULES, productContext].filter(Boolean).join("\n\n");

  const messages: Anthropic.MessageParam[] = conversation.messages
    .filter((m) => m.id !== inboundMessageId || m.direction === "INBOUND")
    .map((m) => ({
      role: m.direction === Direction.INBOUND ? "user" : "assistant",
      content: m.body,
    }));

  const inboundMsg = conversation.messages.find((m) => m.id === inboundMessageId);
  if (!inboundMsg) return;

  // Build user content — include image if present
  let userContent: Anthropic.MessageParam["content"] = inboundMsg.body;

  if (inboundMsg.mediaUrl) {
    try {
      let imageSource: Anthropic.Base64ImageSource | Anthropic.URLImageSource | null = null;

      if (inboundMsg.mediaUrl.startsWith("wa_media:")) {
        // WhatsApp — resolve media ID to URL, then download
        const mediaId = inboundMsg.mediaUrl.replace("wa_media:", "");
        const mediaUrl = await resolveWhatsAppMediaUrl(mediaId);
        if (mediaUrl) {
          const img = await downloadAsBase64(mediaUrl, true);
          if (img) {
            imageSource = { type: "base64", media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: img.data };
          }
        }
      } else {
        // Instagram / Facebook — public URL
        imageSource = { type: "url", url: inboundMsg.mediaUrl };
      }

      if (imageSource) {
        userContent = [
          { type: "image", source: imageSource },
          {
            type: "text",
            text: inboundMsg.body.includes("Customer sent a photo")
              ? "The customer sent this photo. Please identify which RB Jewelry product this is and share its name, price, available sizes, and a direct link to rbjewelry.co to order it."
              : inboundMsg.body,
          },
        ];
      }
    } catch (err) {
      console.error("Failed to load customer image:", err);
    }
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: userContent });
  } else {
    // Replace last user message with vision-enhanced version
    messages[messages.length - 1] = { role: "user", content: userContent };
  }

  // Only offer image tool for DM platforms
  const canSendImages = [Platform.WHATSAPP, Platform.INSTAGRAM_DM, Platform.FACEBOOK_DM].includes(
    conversation.platform
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: config.maxTokens ?? 400,
    system: systemPrompt,
    messages,
    ...(canSendImages ? { tools: TOOLS, tool_choice: { type: "auto" as const } } : {}),
  });

  // Handle tool use (send product image)
  let imageSent = false;
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "send_product_image") {
      const input = block.input as { product_name: string; caption?: string };
      const product = await findProductImage(input.product_name);
      if (product) {
        const caption = input.caption ?? `${product.title} — ${product.price}`;
        try {
          await sendImage(conversation.platform, conversation.externalId, product.imageUrl, caption);
          imageSent = true;
          // Save image message to DB
          await db.message.create({
            data: {
              conversationId,
              direction: Direction.OUTBOUND,
              body: `[Image] ${product.title} — ${caption}`,
              isAiGenerated: true,
              deliveredAt: new Date(),
            },
          });
        } catch (err) {
          console.error("Failed to send product image:", err);
        }
      }
    }
  }

  // Extract text reply
  const replyText = response.content.find((b) => b.type === "text")?.text ?? "";
  if (!replyText && !imageSent) return;
  if (!replyText) {
    await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), unreadCount: 0 } });
    return;
  }

  // Save outbound text message
  const outbound = await db.message.create({
    data: {
      conversationId,
      direction: Direction.OUTBOUND,
      body: replyText,
      isAiGenerated: true,
    },
  });

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

    await db.message.update({ where: { id: outbound.id }, data: { deliveredAt: new Date() } });
  } catch (err) {
    console.error("Failed to send AI reply:", err);
  }

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
