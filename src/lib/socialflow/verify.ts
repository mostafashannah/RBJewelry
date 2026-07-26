import crypto from "crypto";

export function verifySocialFlowSignature(rawBody: Buffer, signatureHeader: string | null): boolean {
  const apiKey = process.env.SOCIALFLOW_API_KEY;
  if (!apiKey || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}
