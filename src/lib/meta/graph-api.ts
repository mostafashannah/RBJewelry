const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export async function graphGet<T>(path: string, token?: string, params?: Record<string, string>): Promise<T> {
  const accessToken = token ?? process.env.META_PAGE_ACCESS_TOKEN!;
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message}`);
  return json as T;
}

export async function graphPost<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const accessToken = token ?? process.env.META_PAGE_ACCESS_TOKEN!;
  const res = await fetch(`${GRAPH_BASE}${path}?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message}`);
  return json as T;
}
