import { graphPost } from "./graph-api";

export async function sendFacebookDM(recipientId: string, text: string) {
  const pageId = process.env.META_FACEBOOK_PAGE_ID ?? "1112587971927536";
  return graphPost(`/${pageId}/messages`, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });
}

export async function sendFacebookImage(recipientId: string, imageUrl: string, caption?: string) {
  const pageId = process.env.META_FACEBOOK_PAGE_ID ?? "1112587971927536";
  const message: Record<string, unknown> = {
    attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } },
  };
  return graphPost(`/${pageId}/messages`, {
    recipient: { id: recipientId },
    message,
    messaging_type: "RESPONSE",
  }).then(async (res) => {
    // Send caption as a follow-up text if provided
    if (caption) {
      await sendFacebookDM(recipientId, caption);
    }
    return res;
  });
}

export async function replyToFacebookComment(commentId: string, text: string) {
  return graphPost(`/${commentId}/comments`, { message: text });
}

