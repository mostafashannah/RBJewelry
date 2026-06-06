export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.id === "admin") {
    return NextResponse.json({ id: "admin", name: "Admin", email: null, role: "ADMIN" });
  }

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
