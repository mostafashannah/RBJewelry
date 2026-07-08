import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const sep = base.includes("?") ? "&" : "?";
  // connection_limit=5: allow concurrent requests on long-running server
  // socket_timeout=30: detect dead connections before Prisma engine panics
  return `${base}${sep}connection_limit=5&pool_timeout=30&connect_timeout=30&socket_timeout=30`;
}

function createClient() {
  const url = buildUrl();
  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();
// Always persist singleton — prevents multiple engine processes across module reloads
globalForPrisma.prisma = db;
