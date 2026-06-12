export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("icon") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const publicDir = path.join(process.cwd(), "public");

  await writeFile(path.join(publicDir, "icon-192.png"), buffer);
  await writeFile(path.join(publicDir, "icon-512.png"), buffer);

  return NextResponse.json({ ok: true });
}
