export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("rb_session")?.value;
  if (!cookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin — plain password cookie
  const adminPwd = process.env.ADMIN_PASSWORD;
  if (adminPwd && cookie === adminPwd) {
    return NextResponse.json({ id: "admin", name: "Admin", role: "ADMIN" });
  }

  // JWT (Mostafa + staff)
  const session = await verifySession(cookie).catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.id } }).catch(() => null);
  if (user) return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });

  // Fallback for legacy admin JWT
  return NextResponse.json({ id: session.id, name: "Admin", role: session.role });
}
