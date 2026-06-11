export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = "2025-01";

export async function GET() {
  const accessToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: "No SHOPIFY_ADMIN_API_ACCESS_TOKEN" });

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

  const mutation = `
    mutation TestShopifyQL($q: String!) {
      shopifyqlTableQuery(query: $q) {
        tableData { columnHeaders { name } rowData unformattedData }
        parseErrors { code message }
      }
    }
  `;

  const queries = [
    "FROM sessions SHOW sessions SINCE -30d UNTIL today",
    "FROM sessions SHOW landing_page_path, sessions GROUP BY landing_page_path ORDER BY sessions DESC LIMIT 10 SINCE -30d UNTIL today",
    "FROM sessions SHOW sessions GROUP BY landing_page_path ORDER BY sessions DESC LIMIT 10 SINCE -30d UNTIL today",
  ];

  const results = [];

  for (const q of queries) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables: { q } }),
      });
      const json = await res.json();
      results.push({ q, httpStatus: res.status, response: json });
    } catch (err) {
      results.push({ q, error: String(err) });
    }
  }

  return NextResponse.json({ domain: SHOPIFY_DOMAIN, apiVersion: API_VERSION, results });
}
