import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();
async function main() {
  const configs = await db.shopifyConfig.findMany();
  console.log("ShopifyConfig rows:", configs.length);
  for (const c of configs) console.log(`  shop=${c.shop} token=${c.accessToken.slice(0,8)}...`);
  const orders = await db.shopifyOrderCache.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log(`\nOrders in DB: ${await db.shopifyOrderCache.count()}`);
  for (const o of orders) {
    const meta = o.lineItemsJson as { customerName?: string };
    console.log(`  #${o.orderNumber} | ${meta?.customerName ?? o.customerEmail ?? "—"} | ${o.totalPrice} ${o.currency} | ${o.status}`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
