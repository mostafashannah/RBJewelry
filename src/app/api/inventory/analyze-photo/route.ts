export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `This is a photo of a jewelry item or its label/tag. Extract the following information if visible:
- name: item description (e.g. "Silver Ring with Zircon", "Gold Necklace")
- sku: any code, SKU, barcode number, or item number visible
- weightG: weight in grams (look for numbers followed by g, gm, gram, جرام, غ)
- category: one of Ring, Necklace, Bracelet, Earrings, Anklet, Set, Other
- material: one of Sterling Silver, Gold-Plated Silver, Rose Gold-Plated, 18K Gold, Other

Return ONLY valid JSON like: {"name":"...","sku":"...","weightG":4.5,"category":"Ring","material":"Sterling Silver"}
Use null for any field you cannot see clearly. No extra text.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ name: null, sku: null, weightG: null, category: null, material: null });
  }
}
