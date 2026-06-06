import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();
async function main() {
  const config = await db.shopifyConfig.findFirst();
  if (!config) { console.log("No config in DB"); return; }
  console.log(`shop: ${config.shop}`);
  console.log(`token: ${config.accessToken.slice(0, 12)}... (${config.accessToken.length} chars)`);
  console.log(`updated: ${config.updatedAt}`);

  // Test the token directly
  const res = await fetch(`https://${config.shop}/admin/api/2024-10/shop.json`, {
    headers: { "X-Shopify-Access-Token": config.accessToken },
  });
  const json = await res.json() as { shop?: { name: string }; errors?: string };
  if (json.shop) console.log(`✅ Token valid — store: ${json.shop.name}`);
  else console.log(`❌ Token invalid: ${json.errors ?? res.status}`);
}
main().catch(console.error).finally(() => db.$disconnect());
