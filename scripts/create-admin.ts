import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const db = new PrismaClient();

// Use same hashPassword logic as auth.ts (PBKDF2 via Web Crypto)
async function hashPassword(password: string): Promise<string> {
  const webcrypto = await import("node:crypto").then(m => m.webcrypto as Crypto);
  const subtle = webcrypto.subtle;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-512", salt, iterations: 100_000 }, key, 512);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function main() {
  const email = "mostafashannah@gmail.com";
  const password = process.env.ADMIN_PASSWORD ?? "RBJewelry2025!";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Update password and role
    await db.user.update({ where: { email }, data: { name: "Mostafa", role: "ADMIN", passwordHash: await hashPassword(password) } });
    console.log("✅ Updated existing Mostafa admin user");
  } else {
    await db.user.create({ data: { name: "Mostafa", email, passwordHash: await hashPassword(password), role: "ADMIN" } });
    console.log("✅ Created Mostafa admin user");
  }
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch(console.error).finally(() => db.$disconnect());
