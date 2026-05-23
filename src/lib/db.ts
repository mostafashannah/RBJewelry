import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Limit connection pool to avoid exhausting Supabase's direct connection limit.
// In production, switch DATABASE_URL to the Supabase Session Pooler (port 5432, pooler host).
const dbUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.includes("?")
    ? `${process.env.DATABASE_URL}&connection_limit=3&pool_timeout=30`
    : `${process.env.DATABASE_URL}?connection_limit=3&pool_timeout=30`
  : undefined;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
