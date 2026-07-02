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
  const { count } = await db.inventoryItem.deleteMany({});
  console.log(`Deleted ${count} inventory item(s).`);
}

main()
  .catch((err) => { console.error("Clear failed:", err); process.exit(1); })
  .finally(() => db.$disconnect());
