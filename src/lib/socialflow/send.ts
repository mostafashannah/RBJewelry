import { Platform } from "@prisma/client";
import { platformToSocialFlowChannel } from "./channel";

const REPLY_URL = process.env.SOCIALFLOW_REPLY_URL ?? "https://socialflow.admepro.com/external-bot-reply.php";

export async function sendSocialFlowReply(params: {
  platform: Platform;
  externalId: string;
  isComment: boolean;
  message: string;
}) {
  const clientId = process.env.SOCIALFLOW_CLIENT_ID;
  const apiKey = process.env.SOCIALFLOW_API_KEY;
  if (!clientId || !apiKey) throw new Error("SOCIALFLOW_CLIENT_ID or SOCIALFLOW_API_KEY not configured");

  const channel = platformToSocialFlowChannel(params.platform);
  if (!channel) throw new Error(`No SocialFlow channel mapping for platform ${params.platform}`);

  const body: Record<string, string> = {
    client_id: clientId,
    channel,
    message: params.message,
  };
  if (params.isComment) {
    body.external_id = params.externalId;
  } else {
    body.recipient_id = params.externalId;
  }

  const res = await fetch(REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`SocialFlow reply failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}
