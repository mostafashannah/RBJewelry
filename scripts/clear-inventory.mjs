/**
 * One-time utility: removes ALL inventory items from the database.
 * Run via CI to wipe the slate clean before manual re-entry.
 */
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const db = new PrismaClient();

async function main() {
  // Only wipe SOLD items — the rebuild script recreates those from static order data.
  // IN_STOCK / RESERVED / DAMAGED items are preserved so manual additions survive deploys.
  const { count } = await db.inventoryItem.deleteMany({ where: { status: "SOLD" } });
  console.log(`Deleted ${count} SOLD inventory item(s). IN_STOCK items preserved.`);
}

main()
  .catch((err) => { console.error("Clear failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
