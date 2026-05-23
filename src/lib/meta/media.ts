const GRAPH_BASE = "https://graph.facebook.com/v19.0";

// Resolve a WhatsApp media ID to a downloadable URL
export async function resolveWhatsAppMediaUrl(mediaId: string): Promise<string | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN!;
  const res = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

// Download media and return as base64 (needed for WhatsApp — URLs require auth header)
export async function downloadAsBase64(
  url: string,
  authRequired = false
): Promise<{ data: string; mediaType: string } | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN!;
  const headers: Record<string, string> = authRequired
    ? { Authorization: `Bearer ${token}` }
    : {};
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const mediaType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    return { data, mediaType: mediaType.split(";")[0] };
  } catch {
    return null;
  }
}
