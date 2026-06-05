import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

async function main() {
  const orders = await db.shopifyOrderCache.findMany();
  const statuses = Array.from(new Set(orders.map((o) => o.status)));
  console.log("Order statuses:", statuses);

  const paid = orders.filter((o) => !o.status.toLowerCase().includes("void") && !o.status.toLowerCase().includes("pending"));
  console.log("Non-voided orders:", paid.length, "total revenue:", paid.reduce((s, o) => s + o.totalPrice, 0).toLocaleString(), "EGP");

  const inv = await db.inventoryItem.findMany({ where: { status: "IN_STOCK" } });
  const stockCost = inv.reduce((s, i) => s + ((i.costEGP ?? 0) * i.quantity), 0);
  const stockPrice = inv.reduce((s, i) => s + ((i.priceEGP ?? 0) * i.quantity), 0);
  console.log(`Stock: ${inv.length} items | Cost value: ${stockCost.toLocaleString()} EGP | Retail value: ${stockPrice.toLocaleString()} EGP`);
}

main().catch(console.error).finally(() => db.$disconnect());
