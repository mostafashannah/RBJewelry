const REPLY_URL = process.env.SOCIALFLOW_REPLY_URL ?? "https://socialflow.admepro.com/external-bot-reply.php";

export async function sendSocialFlowReply(params: {
  channel: string;
  recipientId?: string | null;
  externalId?: string | null;
  message: string;
}): Promise<void> {
  const clientId = process.env.SOCIALFLOW_CLIENT_ID;
  const apiKey = process.env.SOCIALFLOW_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error("SOCIALFLOW_CLIENT_ID / SOCIALFLOW_API_KEY not configured");
  }

  const body: Record<string, unknown> = {
    client_id: clientId,
    channel: params.channel,
    message: params.message,
  };
  if (params.externalId) {
    body.external_id = params.externalId;
  } else {
    body.recipient_id = params.recipientId;
  }

  const res = await fetch(REPLY_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SocialFlow reply failed (${res.status}): ${text}`);
  }
}
