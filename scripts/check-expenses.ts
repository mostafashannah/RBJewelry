import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

async function main() {
  const all = await db.expense.findMany({ orderBy: [{ date: "asc" }, { amount: "asc" }] });
  console.log(`Total: ${all.length} expenses`);
  for (const e of all) {
    console.log(`${e.date.toISOString().split("T")[0]} | ${e.amount.toLocaleString()} EGP | ${e.category} | ${e.description}`);
  }
  const total = all.reduce((s, e) => s + e.amount, 0);
  console.log(`\nGrand total: ${total.toLocaleString()} EGP`);
}

main().catch(console.error).finally(() => db.$disconnect());
