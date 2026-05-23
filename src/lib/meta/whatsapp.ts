import { graphPost } from "./graph-api";

const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;

export async function sendWhatsAppMessage(to: string, text: string) {
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });
}

export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: { link: imageUrl, caption: caption ?? "" },
  });
}

export async function markWhatsAppRead(messageId: string) {
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

