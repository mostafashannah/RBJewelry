export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Keys we manage via the Connections UI
const MANAGED_KEYS = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
  "SHOPIFY_ADMIN_API_ACCESS_TOKEN",
  "META_PAGE_ACCESS_TOKEN",
  "META_APP_SECRET",
  "META_INSTAGRAM_BUSINESS_ACCOUNT_ID",
  "META_WHATSAPP_PHONE_NUMBER_ID",
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

const ENV_PATH = path.join(process.cwd(), ".env.local");

/** Read .env.local and return a key→value map for all lines */
async function readEnvFile(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        // Strip surrounding quotes if present
        const val = match[2].replace(/^"(.*)"$/, "$1");
        map.set(match[1], val);
      }
    }
  } catch {
    // File doesn't exist yet – fine, we'll create it on write
  }
  return map;
}

/** Rewrite .env.local, updating only the keys in `updates` */
async function writeEnvFile(updates: Partial<Record<ManagedKey, string>>) {
  let raw = "";
  try {
    raw = await fs.readFile(ENV_PATH, "utf8");
  } catch {
    raw = "";
  }

  const lines = raw.split("\n");
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return line;
    const key = match[1] as ManagedKey;
    if (key in updates && updates[key] !== undefined && updates[key] !== "") {
      updatedKeys.add(key);
      return `${key}="${updates[key]}"`;
    }
    return line;
  });

  // Append any keys that weren't found in the existing file
  for (const [key, val] of Object.entries(updates) as [ManagedKey, string][]) {
    if (val && !updatedKeys.has(key)) {
      newLines.push(`${key}="${val}"`);
    }
  }

  await fs.writeFile(ENV_PATH, newLines.join("\n"), "utf8");
}

export async function GET() {
  const env = await readEnvFile();

  const status: Record<string, boolean> = {};
  for (const key of MANAGED_KEYS) {
    const val = env.get(key) ?? process.env[key] ?? "";
    // "set" means the value exists and isn't a placeholder
    status[key] = Boolean(
      val &&
        val !== "" &&
        !val.startsWith("shpat_...") &&
        !val.startsWith("public_...") &&
        !val.startsWith("act_...") &&
        val !== "your-store.myshopify.com"
    );
  }

  return NextResponse.json({ status });
}

const isString = (v: unknown): v is string => typeof v === "string";

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<Record<ManagedKey, string>> = {};
  for (const key of MANAGED_KEYS) {
    if (key in body && isString(body[key]) && (body[key] as string).trim() !== "") {
      updates[key] = (body[key] as string).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  await writeEnvFile(updates);

  return NextResponse.json({
    ok: true,
    message: "Saved. Restart the server for changes to take effect.",
    updated: Object.keys(updates),
  });
}
