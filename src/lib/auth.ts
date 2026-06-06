export type SessionUser = { id: string; role: "ADMIN" | "LIMITED" };

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.ADMIN_PASSWORD ?? "rb-dev-secret";
}

async function makeKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

function b64url(buf: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(buf));
  return btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromb64url(s: string): ArrayBuffer {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload = btoa(JSON.stringify(user)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const key = await makeKey(["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(cookie: string): Promise<SessionUser | null> {
  const dot = cookie.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  try {
    const key = await makeKey(["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromb64url(sig), new TextEncoder().encode(payload));
    if (!valid) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-512", salt, iterations: 100_000 },
    key,
    512,
  );
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-512", salt, iterations: 100_000 },
    key,
    512,
  );
  const check = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return check === hashHex;
}

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)rb_session=([^;]+)/);
  if (!match) return null;
  return verifySession(decodeURIComponent(match[1]));
}
