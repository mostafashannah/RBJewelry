export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// Hit GET /api/meta/subscribe to subscribe your Facebook Page to messenger webhooks.
// This must be done once after configuring the webhook URL in Meta Developer Console.
export async function GET() {
  const pageId = process.env.META_FACEBOOK_PAGE_ID ?? "1112587971927536";
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageToken) {
    return NextResponse.json(
      { error: "META_PAGE_ACCESS_TOKEN is not set in .env.local" },
      { status: 500 }
    );
  }

  const fields = [
    "messages",
    "messaging_postbacks",
    "feed",
    "message_echoes",
    "message_deliveries",
    "messaging_optins",
    "messaging_referrals",
  ].join(",");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=${fields}&access_token=${pageToken}`,
    { method: "POST" }
  );
  const json = await res.json();

  if (json.error) {
    return NextResponse.json({ error: json.error.message, detail: json.error }, { status: 400 });
  }

  // Also check current subscriptions so we can see what's active
  const check = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${pageToken}`
  );
  const checkJson = await check.json();

  return NextResponse.json({ ok: true, result: json, pageId, currentSubscriptions: checkJson });
}
