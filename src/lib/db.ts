import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.includes("?")
    ? `${process.env.DATABASE_URL}&connection_limit=1&pool_timeout=20&connect_timeout=30`
    : `${process.env.DATABASE_URL}?connection_limit=1&pool_timeout=20&connect_timeout=30`
  : undefined;

function createClient() {
  try {
    return new PrismaClient({
      datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  } catch (err) {
    console.error("[db] PrismaClient instantiation failed:", err);
    // Return a minimal proxy so imports don't crash — queries will fail at call time
    return new PrismaClient();
  }
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
