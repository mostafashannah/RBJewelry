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

  // Demo
  if (cookie === "demo-access") {
    return NextResponse.json({ id: "demo", name: "Demo", role: "LIMITED" });
  }

  // JWT (staff users)
  const session = await verifySession(cookie).catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.id === "admin") {
    return NextResponse.json({ id: "admin", name: "Admin", role: "ADMIN" });
  }

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
