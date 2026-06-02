export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;
const REDIRECT_URI = "https://app.rbjewelry.net/api/shopify/auth";

async function saveTokenToEnv(token: string) {
  const envPath = path.join(process.cwd(), ".env");
  try {
    let raw = await fs.readFile(envPath, "utf8").catch(() => "");
    if (raw.includes("SHOPIFY_ADMIN_API_ACCESS_TOKEN=")) {
      raw = raw.replace(/SHOPIFY_ADMIN_API_ACCESS_TOKEN="[^"]*"/, `SHOPIFY_ADMIN_API_ACCESS_TOKEN="${token}"`);
    } else {
      raw += `\nSHOPIFY_ADMIN_API_ACCESS_TOKEN="${token}"`;
    }
    await fs.writeFile(envPath, raw, "utf8");
  } catch {
    // best-effort
  }
}

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
  await saveTokenToEnv(access_token);

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px">
      <h2 style="color:#16a34a">✅ Shopify Connected!</h2>
      <p>Your store <strong>${SHOP}</strong> is now connected. The access token has been saved automatically.</p>
      <p style="margin-top:20px"><a href="/settings" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">← Back to Settings</a></p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
