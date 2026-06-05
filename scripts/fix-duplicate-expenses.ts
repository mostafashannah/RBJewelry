import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

async function main() {
  const all = await db.expense.findMany({ orderBy: { date: "asc" } });
  console.log("Total before cleanup:", all.length);

  // Keep the first of each duplicate (same amount + date + description)
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const e of all) {
    const key = `${e.amount}|${e.date.toISOString().split("T")[0]}|${e.description}`;
    if (seen.has(key)) {
      toDelete.push(e.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await db.expense.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`Deleted ${toDelete.length} duplicates`);
  } else {
    console.log("No duplicates found");
  }

  const remaining = await db.expense.count();
  console.log("Total after cleanup:", remaining);
}

main().catch(console.error).finally(() => db.$disconnect());
