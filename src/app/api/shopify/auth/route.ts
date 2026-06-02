export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;
const REDIRECT_URI = "https://app.rbjewelry.net/api/shopify/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");

  if (!CLIENT_ID || !SHOP) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px">
        <h2>⚠️ Not configured</h2>
        <p>Save your <strong>Store Domain</strong>, <strong>Client ID</strong> and <strong>Client Secret</strong> in Settings → Connections first, then click Connect again.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Step 1 — no code: redirect to Shopify OAuth
  if (!code) {
    const scopes = "read_products,read_orders,write_orders";
    const authUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    return NextResponse.redirect(authUrl);
  }

  // Step 2 — exchange code for token
  const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px"><h2>❌ Token exchange failed</h2><pre>${err}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const { access_token } = await tokenRes.json();
  await db.shopifyConfig.upsert({
    where: { shop: SHOP },
    update: { accessToken: access_token },
    create: { shop: SHOP, accessToken: access_token },
  });

  // Register webhooks so order updates flow into our DB automatically
  const webhookTopics = [
    "orders/create",
    "orders/updated",
    "orders/fulfilled",
    "fulfillments/create",
    "fulfillments/update",
    "products/create",
    "products/update",
    "products/delete",
  ];
  const webhookEndpoint = "https://app.rbjewelry.net/api/webhooks/shopify";
  for (const topic of webhookTopics) {
    await fetch(`https://${SHOP}/admin/api/2024-10/webhooks.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: { topic, address: webhookEndpoint, format: "json" },
      }),
    }).catch(() => {/* ignore duplicate-registration errors */});
  }

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px">
      <h2 style="color:#16a34a">✅ Shopify Connected!</h2>
      <p>Your store <strong>${SHOP}</strong> is now connected. The access token has been saved automatically.</p>
      <p style="margin-top:20px"><a href="/settings" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">← Back to Settings</a></p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
