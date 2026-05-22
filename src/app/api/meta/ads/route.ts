export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta/ads";

export async function GET(req: NextRequest) {
  const datePreset = req.nextUrl.searchParams.get("datePreset") ?? "last_30d";
  try {
    const campaigns = await getCampaigns(datePreset);
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
