import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getProductContextString } from "./product-context";
import { buildSystemPrompt, CORE_RULES } from "./system-prompt";
import { sendInstagramDM, sendInstagramImage, replyToInstagramComment } from "@/lib/meta/instagram";
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/meta/whatsapp";
import { sendFacebookDM, sendFacebookImage, replyToFacebookComment } from "@/lib/meta/facebook";
import { resolveWhatsAppMediaUrl, downloadAsBase64 } from "@/lib/meta/media";
import { lookupOrders } from "@/lib/shopify/admin";
import { Platform, Direction } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Tool definition — lets the AI send a product photo
const TOOLS: Anthropic.Tool[] = [
  {
    name: "check_order_status",
    description:
      "Look up a customer's order status from Shopify. Call this tool in two situations: (1) when a customer asks about their order AND you already have their phone number — pass both order_number and phone together; (2) on WhatsApp, always pass the phone automatically. IMPORTANT: if the customer just sent you a phone number after you asked for it, call this tool immediately with the order number from earlier in the conversation and the phone they just provided — do NOT reply generically.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_number: {
          type: "string",
          description: "The order number the customer mentioned (e.g. '1234' or '#1234'). Optional.",
        },
        phone: {
          type: "string",
          description: "Customer phone number to search by (digits only, e.g. '201038337698'). Use for WhatsApp conversations.",
        },
        customer_name: {
          type: "string",
          description: "Customer name to search by if no order number or phone is available.",
        },
      },
      required: [],
    },
  },
  {
    name: "send_product_image",
    description:
      "Send ONE product photo to the customer. Call this tool once per product — do NOT call it more than once for the same product, even if the customer asks again. If showing multiple products, call this tool separately for each one. Only use for DM platforms (not comments).",
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

function describeOrderPhase(fulfillmentStatus: string | null, shipmentStatus: string | null): string {
  const fs = (fulfillmentStatus ?? "").toUpperCase();
  const ss = (shipmentStatus ?? "").toUpperCase();

  if (fs === "UNFULFILLED" || !fs) {
    return "Still being crafted — your piece is handmade especially for you (5–7 business days)";
  }
  if (ss === "OUT_FOR_DELIVERY") return "Out for delivery today — should arrive very soon!";
  if (ss === "DELIVERED") return "Delivered! We hope you love it ❤";
  if (ss === "ATTEMPTED_DELIVERY") return "Courier attempted delivery but couldn't reach you — please contact them to reschedule";
  if (ss === "IN_TRANSIT" || ss === "CONFIRMED" || ss === "PICKED_UP") return "Picked up by the courier and on its way to you";
  if (ss === "LABEL_PRINTED" || ss === "LABEL_PURCHASED") return "Packed and ready — waiting for courier pickup";
  if (fs === "PARTIAL") return "Partially shipped — part of your order is on its way";
  if (fs === "FULFILLED") return "Shipped and on its way to you";
  return "Being processed";
}

async function findProductImage(productName: string): Promise<{ imageUrl: string; title: string; price: string } | null> {
  const name = productName.toLowerCase();
  const products = await db.shopifyProductCache.findMany({ where: { available: true } });
  const match = products.find((p) => p.title.toLowerCase().includes(name)) ?? products[0];
  if (!match?.imageUrl) return null;

  const salePrice = match.priceMin === match.priceMax
    ? `${match.priceMin} EGP`
    : `${match.priceMin}–${match.priceMax} EGP`;

  // Check for compare-at price in rawJson
  const raw = match.rawJson as { variants?: { price: string; compare_at_price?: string | null }[] } | null;
  const compareAtPrices = (raw?.variants ?? [])
    .map((v) => parseFloat(v.compare_at_price ?? "0"))
    .filter((n) => n > 0);
  const originalMin = compareAtPrices.length > 0 ? Math.min(...compareAtPrices) : null;
  const onSale = originalMin !== null && originalMin > match.priceMin;

  const price = onSale ? `~~${originalMin} EGP~~ ${salePrice}` : salePrice;
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

function isOrderQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    "order", "orders", "طلب", "طلبي", "طلبيتي", "طلبتي", "طلباتي",
    "شحن", "وصل", "وصلت", "وصلتش", "توصيل", "delivery", "delivered",
    "tracking", "تتبع", "track", "حالة", "status", "فين طلبي",
    "امتى", "متى", "كيمت", "ورد", "لسا", "جاي", "جه",
  ];
  if (keywords.some((k) => lower.includes(k))) return true;
  // Customer replying with a phone number (answering bot's "what's your number?" question)
  if (/^\s*\+?[\d\s\-]{8,15}\s*$/.test(text.trim())) return true;
  return false;
}

function extractPhone(text: string): string | null {
  // Match Egyptian numbers: 01XXXXXXXXX (11 digits), allow 10 digits (missing last digit typo),
  // and country-code variants like +201... or 201...
  const match = text.match(/\b((?:\+?2)?01[0-9]{8,9}|(?:\+?20)[0-9]{9,10})\b/);
  return match ? match[0].replace(/[^0-9]/g, "") : null;
}

function extractOrderNumber(text: string): string | null {
  const match = text.match(/#?(\d{3,6})/);
  return match ? match[1] : null;
}

async function preflightOrderLookup(
  platform: Platform,
  externalId: string,
  currentMsg: string,
  history: string,
): Promise<string | null> {
  let phone: string | null = null;
  let orderNum: string | null = null;

  if (platform === Platform.WHATSAPP) {
    phone = externalId.replace(/[^0-9]/g, "");
  } else {
    // Scan full conversation text for a phone number
    phone = extractPhone(currentMsg) ?? extractPhone(history);
  }

  orderNum = extractOrderNumber(currentMsg) ?? extractOrderNumber(history);

  const query = orderNum ? `name:#${orderNum}` : phone ? `phone:${phone}` : null;
  if (!query) return null;

  try {
    const orders = await lookupOrders(query);
    if (!orders.length) return "ORDER_NOT_FOUND: No order found with those details. Tell the customer kindly you couldn't find a matching order and ask them to double-check their order number or phone.";

    // If we searched by order number, verify the phone matches before revealing status
    if (orderNum && phone) {
      const orderPhone = (orders[0].phone ?? "").replace(/[^0-9]/g, "");
      const matches = orderPhone && (
        orderPhone === phone ||
        orderPhone.endsWith(phone.slice(-8)) ||
        phone.endsWith(orderPhone.slice(-8))
      );
      if (!matches) {
        return "PHONE_MISMATCH: The phone number provided doesn't match this order. Tell the customer kindly you couldn't verify the order with that number, and ask them to check again.";
      }
    }

    return orders.map((o) => {
      const items = o.items.map((i) => `${i.quantity}x ${i.title}`).join(", ");
      const phase = describeOrderPhase(o.fulfillmentStatus, o.shipmentStatus);
      const tracking = o.trackingNumber ? ` Tracking: ${o.trackingNumber}` : "";
      return `Order ${o.orderNumber} (${items}): ${phase}.${tracking}`;
    }).join("\n");
  } catch (err) {
    console.error("[AI] Pre-flight order lookup failed:", err);
    return null;
  }
}

function isBestSellerQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "best seller", "best sellers", "best sell", "bestseller", "bestsellers",
    "most popular", "top products", "popular products",
    "أكثر مبيعاً", "أكتر مبيعاً", "الأكثر مبيعا", "اكثر مبيعا",
    "أشهر قطع", "اشهر قطع", "أشهر منتجاتكم", "أشهر منتجاتك",
    "الأشهر عندكم", "الأشهر عندكي", "اشهر قطعكم",
    "وريني منتجاتك", "وريني قطعك", "وريني كل", "شوفيني منتجاتك",
    "اشوف منتجاتك", "أشوف منتجاتك",
  ].some((k) => lower.includes(k));
}

async function getBestSellerProducts(limit = 4) {
  // Prefer products tagged "best-seller" in Shopify
  const tagged = await db.shopifyProductCache.findMany({
    where: { available: true, tags: { has: "best-seller" } },
    take: limit,
  });
  if (tagged.length > 0) return tagged;
  // Fall back to first N available products
  return db.shopifyProductCache.findMany({
    where: { available: true },
    take: limit,
    orderBy: { syncedAt: "asc" },
  });
}

export async function processInboundMessage(conversationId: string, inboundMessageId: string) {
  const startMs = Date.now();
  console.log(`[AI] processInboundMessage called: conv=${conversationId} msg=${inboundMessageId}`);

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "desc" }, take: 20 } },
  });
  // Load ALL previously sent image titles (full history) to prevent duplicates in long conversations
  const allSentImages = conversation
    ? await db.message.findMany({
        where: {
          conversationId,
          direction: Direction.OUTBOUND,
          body: { startsWith: "[Image]" },
          id: { not: inboundMessageId },
        },
        select: { body: true },
      })
    : [];
  if (!conversation) {
    console.log("[AI] Conversation not found, skipping");
    return;
  }
  // Reverse so messages are in chronological order (oldest first)
  conversation.messages.reverse();

  const config = await db.aiConfig.findFirst();
  if (!config?.autoReplyEnabled) {
    console.log("[AI] Auto-reply disabled in config");
    return;
  }
  if (!config.platforms.includes(conversation.platform)) {
    console.log(`[AI] Platform ${conversation.platform} not in enabled list:`, config.platforms);
    return;
  }
  console.log(`[AI] Processing reply for platform=${conversation.platform}`);

  const productContext = await getProductContextString();
  // Always use DB prompt if set, otherwise use the default. Always append CORE_RULES and product context.
  const basePrompt = config.systemPrompt || buildSystemPrompt(productContext);
  const systemPrompt = [basePrompt, CORE_RULES, productContext].filter(Boolean).join("\n\n");

  // Build conversation history — skip the current inbound message (added below)
  // and scrub outbound messages that contain WhatsApp redirects.
  // [Image] messages are kept but converted to a short note so Claude knows what was already shown.
  const rawHistory = conversation.messages.filter(
    (m) => m.id !== inboundMessageId &&
      !(m.direction === Direction.OUTBOUND && (m.body.includes("wa.me") || m.body.includes("واتساب") && m.body.includes("تواصل")))
  );

  // Pre-populate sent product titles from FULL history so we never resend in long conversations
  const sentProductTitles = new Set<string>(
    allSentImages.map((m) => {
      const inner = m.body.replace(/^\[Image\]\s*/, "");
      return inner.split(" — ")[0].toLowerCase().trim();
    })
  );

  const messages: Anthropic.MessageParam[] = [];
  for (const m of rawHistory) {
    const role = m.direction === Direction.INBOUND ? "user" : "assistant";
    // Convert [Image] records to a brief assistant note Claude can reason about
    const body = (m.direction === Direction.OUTBOUND && m.body.startsWith("[Image]"))
      ? `📸 ${m.body.replace(/^\[Image\]\s*/, "").split(" — ")[0]} — photo already sent`
      : m.body;
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      const prev = messages[messages.length - 1];
      prev.content = `${prev.content as string}\n${body}`;
    } else {
      messages.push({ role, content: body });
    }
  }

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
        // Facebook / Instagram CDN URLs are signed and expire — download immediately to base64
        const img = await downloadAsBase64(inboundMsg.mediaUrl, false);
        if (img) {
          imageSource = { type: "base64", media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: img.data };
        }
      }

      if (imageSource) {
        userContent = [
          { type: "image", source: imageSource },
          {
            type: "text",
            text: inboundMsg.body.includes("Customer sent a photo")
              ? "The customer sent this photo. Identify which RB Jewelry product this is, then IMMEDIATELY call send_product_image to show them that product photo, then share its name, price, available sizes, and link to rbjewelry.co."
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

  // Pre-flight order lookup — runs before Claude so we always have real data for order queries
  const historyText = conversation.messages.map((m) => m.body).join(" ");
  let finalSystemPrompt = systemPrompt;
  let skipOrderTool = false;

  if (isOrderQuery(inboundMsg.body)) {
    const orderData = await preflightOrderLookup(
      conversation.platform,
      conversation.externalId,
      inboundMsg.body,
      historyText,
    );

    if (orderData) {
      finalSystemPrompt = `${systemPrompt}\n\n[SHOPIFY ORDER DATA — use this directly in your reply, do NOT call check_order_status]\n${orderData}`;
      skipOrderTool = true;
      console.log(`[AI] Pre-flight order data injected: ${orderData.slice(0, 100)}`);
    } else if (conversation.platform !== Platform.WHATSAPP) {
      // No phone / order number available — instruct Claude to ask for phone
      finalSystemPrompt = `${systemPrompt}\n\n[ORDER QUERY DETECTED — you do not have the customer's phone number yet. Ask for it politely before giving any order status. Do NOT make up any status.]`;
      skipOrderTool = true;
    }
  }

  // Image tool only for DM platforms; order status tool when not handled by pre-flight
  const canSendImages = ([Platform.WHATSAPP, Platform.INSTAGRAM_DM, Platform.FACEBOOK_DM] as Platform[]).includes(
    conversation.platform
  );
  const activeTools = (canSendImages ? TOOLS : TOOLS.filter((t) => t.name !== "send_product_image"))
    .filter((t) => !(skipOrderTool && t.name === "check_order_status"));

  // Pre-flight best seller images — send photos directly before Claude writes text
  let imageSent = false;
  if (isBestSellerQuery(inboundMsg.body) && canSendImages) {
    const bestSellers = await getBestSellerProducts(4);
    const sentTitles: string[] = [];
    for (const product of bestSellers) {
      if (!product.imageUrl) continue;
      const price = product.priceMin === product.priceMax
        ? `${product.priceMin} EGP`
        : `${product.priceMin}–${product.priceMax} EGP`;
      const caption = `${product.title} — ${price}`;
      try {
        if (imageSent) await new Promise((r) => setTimeout(r, 700));
        await sendImage(conversation.platform, conversation.externalId, product.imageUrl, caption);
        imageSent = true;
        sentProductTitles.add(product.title.toLowerCase().trim());
        sentTitles.push(product.title);
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
        console.error("[AI] Pre-flight best seller image failed:", err);
      }
    }
    if (sentTitles.length > 0) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n[PHOTOS ALREADY SENT: ${sentTitles.join(", ")} — do NOT call send_product_image for these again. Write a short warm text describing them.]`;
    }
  }

  console.log(`[AI] Calling Anthropic API, key prefix=${process.env.ANTHROPIC_API_KEY?.slice(0, 10)}, messages=${messages.length}`);
  let firstResponse: Anthropic.Message;
  try {
    firstResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: config.maxTokens ?? 400,
      system: finalSystemPrompt,
      messages,
      ...(activeTools.length > 0 ? { tools: activeTools, tool_choice: { type: "auto" as const } } : {}),
    });
  } catch (err) {
    console.error("[AI] Anthropic API call failed:", err);
    return;
  }
  console.log(`[AI] First response stop_reason=${firstResponse.stop_reason} blocks=${firstResponse.content.length}`);

  let replyText = "";
  let inputTokens = firstResponse.usage.input_tokens;
  let outputTokens = firstResponse.usage.output_tokens;

  if (firstResponse.stop_reason === "tool_use") {
    // Execute all tool calls and collect results for multi-turn completion
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    // Seed from prior turns so we never resend a product seen earlier in this conversation
    const sentInThisTurn = new Set<string>(sentProductTitles);
    for (const block of firstResponse.content) {
      if (block.type === "tool_use" && block.name === "check_order_status") {
        const input = block.input as { order_number?: string; phone?: string; customer_name?: string };
        try {
          // WhatsApp: auto-use platform phone
          const platformPhone = conversation.platform === Platform.WHATSAPP
            ? conversation.externalId.replace(/[^0-9]/g, "")
            : null;
          const providedPhone = input.phone?.replace(/[^0-9]/g, "") ?? platformPhone ?? null;

          // If no phone provided on non-WhatsApp platforms, ask for it
          if (!providedPhone && conversation.platform !== Platform.WHATSAPP) {
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "PHONE_REQUIRED: Ask the customer for their mobile number before checking the order." });
          } else {
            // Search by order number first, then fall back to phone
            let query = "";
            if (input.order_number) {
              const num = input.order_number.replace(/[^0-9]/g, "");
              query = `name:#${num}`;
            } else if (providedPhone) {
              query = `phone:${providedPhone}`;
            } else if (input.customer_name) {
              query = input.customer_name;
            }

            if (!query) {
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "No order number or phone provided. Ask the customer for their mobile number." });
            } else {
              const orders = await lookupOrders(query);
              if (!orders.length) {
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "No orders found matching this customer's details." });
              } else {
                // If searching by order number, verify the phone matches
                if (input.order_number && providedPhone) {
                  const orderPhone = orders[0].phone?.replace(/[^0-9]/g, "") ?? "";
                  const phoneMatches = orderPhone && (
                    orderPhone === providedPhone ||
                    orderPhone.endsWith(providedPhone.slice(-8)) ||
                    providedPhone.endsWith(orderPhone.slice(-8))
                  );
                  if (!phoneMatches) {
                    toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "PHONE_MISMATCH: The mobile number provided doesn't match the order. Tell the customer kindly that you couldn't verify their order with that number." });
                  } else {
                    const summary = orders.map((o) => {
                      const items = o.items.map((i) => `${i.quantity}x ${i.title}`).join(", ");
                      const phase = describeOrderPhase(o.fulfillmentStatus, o.shipmentStatus);
                      const tracking = o.trackingNumber ? ` Tracking: ${o.trackingNumber}` : "";
                      return `Order ${o.orderNumber} (${items}): ${phase}.${tracking}`;
                    }).join("\n");
                    toolResults.push({ type: "tool_result", tool_use_id: block.id, content: summary });
                  }
                } else {
                  const summary = orders.map((o) => {
                    const items = o.items.map((i) => `${i.quantity}x ${i.title}`).join(", ");
                    const phase = describeOrderPhase(o.fulfillmentStatus, o.shipmentStatus);
                    const tracking = o.trackingNumber ? ` Tracking: ${o.trackingNumber}` : "";
                    return `Order ${o.orderNumber} (${items}): ${phase}.${tracking}`;
                  }).join("\n");
                  toolResults.push({ type: "tool_result", tool_use_id: block.id, content: summary });
                }
              }
            }
          }
        } catch (err) {
          console.error("Order lookup failed:", err);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "ORDER_LOOKUP_ERROR: Could not connect to check order status right now. Tell the customer there is a temporary technical issue and you will follow up shortly." });
        }
      } else if (block.type === "tool_use" && block.name === "send_product_image") {
        const input = block.input as { product_name: string; caption?: string };
        const product = await findProductImage(input.product_name);
        if (product) {
          if (sentInThisTurn.has(product.title.toLowerCase().trim())) {
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Already sent image of "${product.title}" — skipped duplicate.` });
            continue;
          }
          const caption = input.caption ?? `${product.title} — ${product.price}`;
          try {
            if (imageSent) await new Promise((r) => setTimeout(r, 800)); // space out multiple images
            await sendImage(conversation.platform, conversation.externalId, product.imageUrl, caption);
            imageSent = true;
            sentInThisTurn.add(product.title.toLowerCase().trim());
            await db.message.create({
              data: {
                conversationId,
                direction: Direction.OUTBOUND,
                body: `[Image] ${product.title} — ${caption}`,
                isAiGenerated: true,
                deliveredAt: new Date(),
              },
            });
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Sent image of "${product.title}".` });
          } catch (err) {
            console.error("Failed to send product image:", err);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Image send failed.", is_error: true });
          }
        } else {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Product not found.", is_error: true });
        }
      }
    }

    // Second call to get Claude's text reply after tool execution
    const followUp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: Math.max(config.maxTokens ?? 400, 300),
      system: finalSystemPrompt,
      messages: [
        ...messages,
        { role: "assistant" as const, content: firstResponse.content },
        { role: "user" as const, content: toolResults },
        // Nudge Claude to always send a follow-up text with CTA
        { role: "user" as const, content: "Now send a short friendly reply (in the same language the customer used) based on the information above — 1-2 sentences max, end with your CTA. STRICT: do NOT mention WhatsApp, do NOT share any phone number or link, do NOT redirect to any channel. Handle it yourself." },
      ],
    });
    replyText = followUp.content.find((b) => b.type === "text")?.text ?? "";
    inputTokens += followUp.usage.input_tokens;
    outputTokens += followUp.usage.output_tokens;
    console.log(`[AI] Follow-up reply: "${replyText.slice(0, 80)}"`);
  } else {
    replyText = firstResponse.content.find((b) => b.type === "text")?.text ?? "";
    console.log(`[AI] Direct reply: "${replyText.slice(0, 80)}"`);
  }

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
      inputTokens,
      outputTokens,
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
