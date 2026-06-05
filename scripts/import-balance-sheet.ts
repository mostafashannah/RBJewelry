// One-time import of expenses from RB Jewelry Balance Sheet 2026
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const db = new PrismaClient();

function parseDate(raw: string): Date {
  // Handles both "4-27-2026" and "5/3/2026"
  const cleaned = raw.trim().replace(/-/g, "/");
  const [m, d, y] = cleaned.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function mapCategory(cat: string, desc: string): string {
  const c = cat.trim();
  const d = desc.toLowerCase();
  if (c === "اعلانات" || d.includes("meta ads") || d.includes("اعلانات")) return "Ad Spend";
  if (c === "خام") return "Materials";
  if (c === "أعمال خارجية") return "Operations";
  if (d.includes("bosta") || d.includes("توصيل")) return "Shipping";
  return "Other";
}

const rawExpenses = [
  // April
  { amount: 29760, desc: "وائل", date: "4-27-2026", cat: "خام" },
  { amount: 1000,  desc: "احجار", date: "4-27-2026", cat: "خام" },
  { amount: 6000,  desc: "استمبات", date: "4-27-2026", cat: "أعمال خارجية" },
  { amount: 11957, desc: "Meta Ads", date: "4-27-2026", cat: "اعلانات" },
  { amount: 630,   desc: "علب خواتم", date: "4-27-2026", cat: "مصاريف" },
  { amount: 160,   desc: "علب اسورة", date: "4-27-2026", cat: "مصاريف" },
  { amount: 180,   desc: "كرتون كرفت", date: "4-27-2026", cat: "مصاريف" },
  { amount: 200,   desc: "انتقالات", date: "4-27-2026", cat: "مصاريف" },
  { amount: 386,   desc: "2 استيكر + ورق A6 + ورق كلك", date: "4-28-2026", cat: "مصاريف" },
  { amount: 750,   desc: "ختم مقاس 4×6", date: "4-28-2026", cat: "مصاريف" },
  { amount: 170,   desc: "انتقالات", date: "4-28-2026", cat: "مصاريف" },
  { amount: 235,   desc: "مقص - قطر - ورق زبدة - 2 كيس ورق", date: "4-30-2026", cat: "مصاريف" },
  { amount: 90,    desc: "توصيل اوردر", date: "4-30-2026", cat: "مصاريف" },
  { amount: 10000, desc: "وائل", date: "4-30-2026", cat: "خام" },
  // May
  { amount: 280,   desc: "توصيل اوردر", date: "5-3-2026", cat: "مصاريف" },
  { amount: 15000, desc: "Meta Ads", date: "5-3-2026", cat: "اعلانات" },
  { amount: 2000,  desc: "Bosta", date: "5-4-2026", cat: "مصاريف" },
  { amount: 1575,  desc: "2 دستة علب خواتم + 24 كارتون كرافت", date: "5-9-2026", cat: "مصاريف" },
  { amount: 300,   desc: "انتقالات", date: "5-9-2026", cat: "مصاريف" },
  { amount: 3000,  desc: "وائل", date: "5-10-2026", cat: "خام" },
  { amount: 5000,  desc: "وائل", date: "5-11-2026", cat: "خام" },
  { amount: 290,   desc: "ورق كلك + توصيل", date: "5-12-2026", cat: "مصاريف" },
  { amount: 5500,  desc: "اعلانات", date: "5-12-2026", cat: "اعلانات" },
  { amount: 300,   desc: "انتقالات - استلام عينات من وائل", date: "5-12-2026", cat: "مصاريف" },
  { amount: 4000,  desc: "وائل", date: "5-14-2026", cat: "خام" },
  { amount: 4600,  desc: "اعلانات", date: "5-18-2026", cat: "اعلانات" },
  { amount: 3070,  desc: "وائل", date: "5-18-2026", cat: "خام" },
  { amount: 200,   desc: "انتقالات - استلام عينات من وائل", date: "5-21-2026", cat: "مصاريف" },
  // June
  { amount: 2000,  desc: "اعلانات", date: "6-1-2026", cat: "اعلانات" },
];

async function main() {
  console.log(`Importing ${rawExpenses.length} expenses...`);

  // Check for existing expenses to avoid duplicates
  const existing = await db.expense.count();
  if (existing > 0) {
    console.log(`⚠️  ${existing} expenses already exist. Skipping duplicates check — inserting all.`);
  }

  const data = rawExpenses.map((e) => ({
    category: mapCategory(e.cat, e.desc),
    amount: e.amount,
    currency: "EGP",
    description: e.desc,
    date: parseDate(e.date),
  }));

  const result = await db.expense.createMany({ data });
  console.log(`✅ Imported ${result.count} expenses`);

  // Print summary
  const total = data.reduce((s, e) => s + e.amount, 0);
  console.log(`Total: ${total.toLocaleString()} EGP`);

  const byCategory = data.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  for (const [cat, amt] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${amt.toLocaleString()} EGP`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
