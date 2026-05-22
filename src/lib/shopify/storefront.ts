const STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!;
const ENDPOINT = `https://${STORE_DOMAIN}/api/2024-04/graphql.json`;

async function storefrontFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Shopify-Storefront-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

export async function getStorefrontProducts(first = 20, after?: string) {
  return storefrontFetch<StorefrontProductsData>(
    `query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id handle title availableForSale
            priceRange { minVariantPrice { amount currencyCode } }
            images(first: 1) { edges { node { url altText } } }
            tags
            productType
          }
          cursor
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { first, after }
  );
}

export async function getStorefrontProduct(handle: string) {
  return storefrontFetch<{ productByHandle: StorefrontProduct | null }>(
    `query GetProduct($handle: String!) {
      productByHandle(handle: $handle) {
        id title description handle availableForSale tags productType
        priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
        images(first: 10) { edges { node { url altText } } }
        variants(first: 50) {
          edges {
            node {
              id title availableForSale
              price { amount currencyCode }
              selectedOptions { name value }
            }
          }
        }
      }
    }`,
    { handle }
  );
}

export async function createCart(lines: { merchandiseId: string; quantity: number }[]) {
  return storefrontFetch<{ cartCreate: { cart: { id: string; checkoutUrl: string } } }>(
    `mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
      }
    }`,
    { input: { lines } }
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorefrontProductEdge {
  node: {
    id: string;
    handle: string;
    title: string;
    availableForSale: boolean;
    priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
    images: { edges: { node: { url: string; altText: string | null } }[] };
    tags: string[];
    productType: string;
  };
  cursor: string;
}

export interface StorefrontProductsData {
  products: {
    edges: StorefrontProductEdge[];
    pageInfo: { hasNextPage: boolean; endCursor: string };
  };
}

export interface StorefrontProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  tags: string[];
  productType: string;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  images: { edges: { node: { url: string; altText: string | null } }[] };
  variants: {
    edges: {
      node: {
        id: string;
        title: string;
        availableForSale: boolean;
        price: { amount: string; currencyCode: string };
        selectedOptions: { name: string; value: string }[];
      };
    }[];
  };
}
