export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signSession, verifyPassword } from "@/lib/auth";

const COOKIE_OPTS = {
  httpOnly: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
};

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  // Staff login — email + password against DB
  if (email) {
    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const token = await signSession({ id: user.id, role: user.role });
    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set("rb_session", token, COOKIE_OPTS);
    return res;
  }

  // Demo access — no real data modification allowed
  if (password === "demo") {
    const token = await signSession({ id: "demo", role: "LIMITED" });
    const res = NextResponse.json({ ok: true, role: "LIMITED" });
    res.cookies.set("rb_session", token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 2 }); // 2h only
    return res;
  }

  // Admin login — password-only (ADMIN_PASSWORD env var)
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = await signSession({ id: "admin", role: "ADMIN" });
  const res = NextResponse.json({ ok: true, role: "ADMIN" });
  res.cookies.set("rb_session", token, COOKIE_OPTS);
  return res;
}
