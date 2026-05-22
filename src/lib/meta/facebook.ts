import { graphPost } from "./graph-api";

export async function sendFacebookDM(recipientId: string, text: string) {
  const pageId = process.env.META_FACEBOOK_PAGE_ID ?? "1112587971927536";
  return graphPost(`/${pageId}/messages`, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });
}

export async function replyToFacebookComment(commentId: string, text: string) {
  return graphPost(`/${commentId}/comments`, { message: text });
}
