export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.id === "admin" || params.id === session.id) {
    return NextResponse.json({ error: "Cannot delete this user" }, { status: 400 });
  }

  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
