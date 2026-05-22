import { graphPost } from "./graph-api";

export async function sendInstagramDM(recipientId: string, text: string) {
  const igAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID!;
  return graphPost(`/${igAccountId}/messages`, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });
}

export async function replyToInstagramComment(commentId: string, text: string) {
  return graphPost(`/${commentId}/replies`, { message: text });
}
