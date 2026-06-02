import { graphPost } from "./graph-api";

export async function sendInstagramDM(recipientId: string, text: string) {
  // Use the Facebook Page endpoint — same token, works without extra app review
  const pageId = process.env.META_FACEBOOK_PAGE_ID!;
  return graphPost(`/${pageId}/messages`, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });
}

export async function sendInstagramImage(recipientId: string, imageUrl: string) {
  const pageId = process.env.META_FACEBOOK_PAGE_ID!;
  return graphPost(`/${pageId}/messages`, {
    recipient: { id: recipientId },
    message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
    messaging_type: "RESPONSE",
  });
}

export async function replyToInstagramComment(commentId: string, text: string) {
  return graphPost(`/${commentId}/replies`, { message: text });
}

