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

  const pageFields = [
    "messages",
    "messaging_postbacks",
    "feed",
    "message_echoes",
    "message_deliveries",
    "messaging_optins",
    "messaging_referrals",
  ].join(",");

  const pageRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=${pageFields}&access_token=${pageToken}`,
    { method: "POST" }
  );
  const pageJson = await pageRes.json();

  if (pageJson.error) {
    return NextResponse.json({ error: pageJson.error.message, detail: pageJson.error }, { status: 400 });
  }

  // Instagram DMs are delivered via the app-level webhook subscription
  // (object: "instagram", field: "messages") which is configured in Meta Developer Console.
  // The Page subscription above also covers IG DMs for connected accounts.
  const igAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const igJson: Record<string, unknown> = { note: "IG DMs handled via app-level webhook subscription", igAccountId: igAccountId ?? null };

  // Check current subscriptions so we can see what's active
  const check = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${pageToken}`
  );
  const checkJson = await check.json();

  return NextResponse.json({
    ok: true,
    pageSubscription: pageJson,
    instagramSubscription: igJson,
    pageId,
    igAccountId: igAccountId ?? null,
    currentPageSubscriptions: checkJson,
  });
}
