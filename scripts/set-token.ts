import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

const NEW_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN ?? "";
const SHOP = "rb-jewelry-4.myshopify.com";

async function main() {
  // Test first
  const res = await fetch(`https://${SHOP}/admin/api/2024-10/shop.json`, {
    headers: { "X-Shopify-Access-Token": NEW_TOKEN },
  });
  const json = await res.json() as { shop?: { name: string }; errors?: string };

  if (!json.shop) {
    console.error("❌ Token rejected:", json.errors ?? res.status);
    return;
  }
  console.log(`✅ Token valid — store: ${json.shop.name}`);

  // Save to DB
  await db.shopifyConfig.upsert({
    where: { shop: SHOP },
    update: { accessToken: NEW_TOKEN },
    create: { shop: SHOP, accessToken: NEW_TOKEN },
  });
  console.log("✅ Token saved to DB");

  // Also update .env.local so local scripts work
  const envPath = path.join(__dirname, "../.env.local");
  const fs = require("fs");
  let env = fs.readFileSync(envPath, "utf8");
  env = env.replace(/SHOPIFY_ADMIN_API_ACCESS_TOKEN=.*/,
    `SHOPIFY_ADMIN_API_ACCESS_TOKEN="${NEW_TOKEN}"`);
  fs.writeFileSync(envPath, env);
  console.log("✅ .env.local updated");
}

main().catch(console.error).finally(() => db.$disconnect());
