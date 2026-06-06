import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

const SHOP = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(".myshopify.com", "");
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

async function getToken() {
  const res = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET }).toString(),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json() as { access_token: string };
  return access_token;
}

async function main() {
  const token = await getToken();
  console.log("✅ Token obtained");

  const res = await fetch(`https://${SHOP}.myshopify.com/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: `{
      products(first: 100, query: "status:active") {
        edges { node {
          id handle title descriptionHtml tags
          images(first: 1) { edges { node { url altText } } }
          variants(first: 10) {
            edges { node { price compareAtPrice availableForSale } }
          }
        }}
      }
    }` }),
  });

  const json = await res.json() as { data?: { products?: { edges?: { node: Record<string, unknown> }[] } } };
  const products = json.data?.products?.edges ?? [];
  console.log(`Got ${products.length} products`);

  let upserted = 0;
  for (const { node: p } of products) {
    const variants = (p.variants as { edges: { node: { price: string; compareAtPrice: string | null; availableForSale: boolean } }[] }).edges;
    const images = (p.images as { edges: { node: { url: string; altText: string | null } }[] }).edges;
    const prices = variants.map(v => parseFloat(v.node.price)).filter(n => !isNaN(n));
    const available = variants.some(v => v.node.availableForSale);

    await db.shopifyProductCache.upsert({
      where: { handle: p.handle as string },
      update: {
        title: p.title as string,
        description: (p.descriptionHtml as string) ?? "",
        priceMin: prices.length ? Math.min(...prices) : 0,
        priceMax: prices.length ? Math.max(...prices) : 0,
        imageUrl: images[0]?.node.url ?? null,
        tags: (p.tags as string[]) ?? [],
        available,
        rawJson: p as object,
        syncedAt: new Date(),
      },
      create: {
        id: p.id as string,
        handle: p.handle as string,
        title: p.title as string,
        description: (p.descriptionHtml as string) ?? "",
        priceMin: prices.length ? Math.min(...prices) : 0,
        priceMax: prices.length ? Math.max(...prices) : 0,
        currency: "EGP",
        imageUrl: images[0]?.node.url ?? null,
        tags: (p.tags as string[]) ?? [],
        available,
        rawJson: p as object,
      },
    });
    upserted++;
    console.log(`  ${p.title} — ${prices[0] ?? 0} EGP`);
  }

  console.log(`\n✅ Synced ${upserted} products`);
}

main().catch(console.error).finally(() => db.$disconnect());
