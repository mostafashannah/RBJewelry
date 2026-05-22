import crypto from "crypto";

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.replace("sha256=", "");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

export function verifyWebhookToken(token: string): boolean {
  return token === process.env.META_WEBHOOK_VERIFY_TOKEN;
}
