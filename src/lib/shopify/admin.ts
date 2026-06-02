import { db } from "@/lib/db";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2024-10";

async function getAccessToken(): Promise<string> {
  const config = await db.shopifyConfig.findFirst({ where: { shop: SHOPIFY_DOMAIN } });
  if (config?.accessToken) return config.accessToken;
  // Fall back to env var (for local dev with a static token)
  const envToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (envToken) return envToken;
  throw new Error("Shopify not connected. Visit /api/shopify/auth to connect.");
}

async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const accessToken = await getAccessToken();
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Shopify Admin API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data as T;
}

const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          status
          descriptionHtml
          tags
          productType
          vendor
          variants(first: 20) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                inventoryQuantity
                inventoryItem { id }
              }
            }
          }
          images(first: 1) {
            edges { node { url altText } }
          }
        }
      }
    }
  }
`;

export async function getProducts(limit = 50, afterCursor?: string): Promise<{ products: ShopifyProduct[] }> {
  const data = await shopifyGraphQL<{
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      edges: { node: {
        id: string; title: string; handle: string; status: string;
        descriptionHtml: string; tags: string[]; productType: string; vendor: string;
        variants: { edges: { node: { id: string; title: string; price: string; sku: string; inventoryQuantity: number; inventoryItem: { id: string } } }[] };
        images: { edges: { node: { url: string; altText: string | null } }[] };
      } }[];
    };
  }>(PRODUCTS_QUERY, { first: limit, after: afterCursor ?? null });

  const products: ShopifyProduct[] = data.products.edges.map(({ node }) => ({
    id: parseInt(node.id.replace("gid://shopify/Product/", "")),
    title: node.title,
    handle: node.handle,
    status: node.status.toLowerCase(),
    body_html: node.descriptionHtml,
    tags: node.tags.join(", "),
    product_type: node.productType,
    vendor: node.vendor,
    variants: node.variants.edges.map(({ node: v }) => ({
      id: parseInt(v.id.replace("gid://shopify/ProductVariant/", "")),
      title: v.title,
      price: v.price,
      compare_at_price: (v as { compareAtPrice?: string | null }).compareAtPrice ?? null,
      sku: v.sku,
      inventory_quantity: v.inventoryQuantity,
      inventory_item_id: parseInt(v.inventoryItem.id.replace("gid://shopify/InventoryItem/", "")),
    })),
    images: node.images.edges.map(({ node: img }) => ({ src: img.url, alt: img.altText })),
  }));

  return { products };
}

const ORDERS_QUERY = `
  query getOrders($first: Int!, $query: String) {
    orders(first: $first, query: $query) {
      edges {
        node {
          id
          name
          email
          phone
          totalPriceSet { shopMoney { amount currencyCode } }
          financialStatus
          fulfillmentStatus
          createdAt
          lineItems(first: 20) {
            edges { node { title quantity originalUnitPriceSet { shopMoney { amount } } } }
          }
          customer { firstName lastName email }
        }
      }
    }
  }
`;

export async function getOrders(limit = 50, status = "any"): Promise<{ orders: ShopifyOrder[] }> {
  const query = status !== "any" ? `status:${status}` : undefined;
  const data = await shopifyGraphQL<{
    orders: { edges: { node: {
      id: string; name: string; email: string; phone: string | null;
      totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      financialStatus: string; fulfillmentStatus: string | null; createdAt: string;
      lineItems: { edges: { node: { title: string; quantity: number; originalUnitPriceSet: { shopMoney: { amount: string } } } }[] };
      customer: { firstName: string; lastName: string; email: string } | null;
    } }[] };
  }>(ORDERS_QUERY, { first: limit, query: query ?? null });

  const orders: ShopifyOrder[] = data.orders.edges.map(({ node }) => ({
    id: parseInt(node.id.replace("gid://shopify/Order/", "")),
    order_number: parseInt(node.name.replace("#", "")),
    email: node.email,
    phone: node.phone,
    total_price: node.totalPriceSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
    financial_status: node.financialStatus?.toLowerCase() ?? "",
    fulfillment_status: node.fulfillmentStatus?.toLowerCase() ?? null,
    created_at: node.createdAt,
    line_items: node.lineItems.edges.map(({ node: li }) => ({
      title: li.title,
      quantity: li.quantity,
      price: li.originalUnitPriceSet.shopMoney.amount,
    })),
    customer: node.customer
      ? { first_name: node.customer.firstName, last_name: node.customer.lastName, email: node.customer.email }
      : null,
  }));

  return { orders };
}

const ORDER_LOOKUP_QUERY = `
  query lookupOrders($query: String!) {
    orders(first: 5, query: $query) {
      edges {
        node {
          name
          phone
          createdAt
          fulfillmentStatus
          financialStatus
          lineItems(first: 10) {
            edges { node { title quantity } }
          }
          fulfillments(first: 5) {
            status
            shipmentStatus
            updatedAt
            trackingInfo { number url }
          }
        }
      }
    }
  }
`;

export interface OrderLookupResult {
  orderNumber: string;
  phone: string | null;
  createdAt: string;
  fulfillmentStatus: string | null;
  financialStatus: string;
  items: { title: string; quantity: number }[];
  shipmentStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

export async function lookupOrders(searchQuery: string): Promise<OrderLookupResult[]> {
  // Try local DB first — fast and works without live Shopify API
  const localResults = await lookupOrdersFromCache(searchQuery);
  if (localResults.length > 0) return localResults;

  // Fall back to live Shopify API
  const data = await shopifyGraphQL<{
    orders: { edges: { node: {
      name: string; phone: string | null; createdAt: string;
      fulfillmentStatus: string | null; financialStatus: string;
      lineItems: { edges: { node: { title: string; quantity: number } }[] };
      fulfillments: { status: string; shipmentStatus: string | null; updatedAt: string; trackingInfo: { number: string; url: string }[] }[];
    } }[] };
  }>(ORDER_LOOKUP_QUERY, { query: searchQuery });

  return data.orders.edges.map(({ node }) => {
    const lastFulfillment = node.fulfillments[node.fulfillments.length - 1] ?? null;
    const tracking = lastFulfillment?.trackingInfo?.[0] ?? null;
    return {
      orderNumber: node.name,
      phone: node.phone ?? null,
      createdAt: node.createdAt,
      fulfillmentStatus: node.fulfillmentStatus ?? null,
      financialStatus: node.financialStatus,
      items: node.lineItems.edges.map(({ node: li }) => ({ title: li.title, quantity: li.quantity })),
      shipmentStatus: lastFulfillment?.shipmentStatus ?? null,
      trackingNumber: tracking?.number ?? null,
      trackingUrl: tracking?.url ?? null,
    };
  });
}

async function lookupOrdersFromCache(searchQuery: string): Promise<OrderLookupResult[]> {
  let rows: Awaited<ReturnType<typeof db.shopifyOrderCache.findMany>> = [];

  if (searchQuery.startsWith("name:#")) {
    const num = searchQuery.replace("name:#", "").trim();
    rows = await db.shopifyOrderCache.findMany({ where: { orderNumber: num }, take: 5 });
  } else if (searchQuery.startsWith("phone:")) {
    const phone = searchQuery.replace("phone:", "").trim().replace(/[^0-9]/g, "");
    // Match last 9 digits to handle country-code variations
    const suffix = phone.slice(-9);
    rows = await db.shopifyOrderCache.findMany({
      where: { customerPhone: { endsWith: suffix } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  } else {
    // Name search — not supported in cache, let Shopify handle it
    return [];
  }

  if (!rows.length) return [];

  return rows.map((r) => {
    const items = (r.lineItemsJson as { title: string; quantity: number }[]) ?? [];
    return {
      orderNumber: `#${r.orderNumber}`,
      phone: r.customerPhone ?? null,
      createdAt: r.createdAt.toISOString(),
      fulfillmentStatus: r.fulfillmentStatus ?? null,
      financialStatus: r.status,
      items: items.map((i) => ({ title: i.title, quantity: i.quantity })),
      shipmentStatus: r.shipmentStatus ?? null,
      trackingNumber: r.trackingNumber ?? null,
      trackingUrl: r.trackingUrl ?? null,
    };
  });
}

export async function syncOrdersToCache() {
  const data = await shopifyGraphQL<{
    orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; edges: { node: {
      id: string; name: string; email: string | null; phone: string | null;
      totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      financialStatus: string; fulfillmentStatus: string | null; createdAt: string;
      lineItems: { edges: { node: { title: string; quantity: number } }[] };
      fulfillments: { status: string; shipmentStatus: string | null; trackingInfo: { number: string; url: string }[] }[];
    } }[] };
  }>(`
    query {
      orders(first: 250, query: "created_at:>2024-01-01") {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id name email phone createdAt financialStatus fulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 20) { edges { node { title quantity } } }
            fulfillments(first: 5) {
              status shipmentStatus
              trackingInfo { number url }
            }
          }
        }
      }
    }
  `);

  for (const { node } of data.orders.edges) {
    const lastFulfillment = node.fulfillments[node.fulfillments.length - 1] ?? null;
    const tracking = lastFulfillment?.trackingInfo?.[0] ?? null;
    const numericId = node.id.replace("gid://shopify/Order/", "");
    const orderNum = node.name.replace("#", "");

    await db.shopifyOrderCache.upsert({
      where: { id: numericId },
      update: {
        status: node.financialStatus.toLowerCase(),
        fulfillmentStatus: node.fulfillmentStatus ?? null,
        shipmentStatus: lastFulfillment?.shipmentStatus ?? null,
        trackingNumber: tracking?.number ?? null,
        trackingUrl: tracking?.url ?? null,
        lineItemsJson: node.lineItems.edges.map(({ node: li }) => ({ title: li.title, quantity: li.quantity })),
        syncedAt: new Date(),
      },
      create: {
        id: numericId,
        orderNumber: orderNum,
        customerEmail: node.email ?? null,
        customerPhone: node.phone ?? null,
        totalPrice: parseFloat(node.totalPriceSet.shopMoney.amount),
        currency: node.totalPriceSet.shopMoney.currencyCode,
        status: node.financialStatus.toLowerCase(),
        fulfillmentStatus: node.fulfillmentStatus ?? null,
        shipmentStatus: lastFulfillment?.shipmentStatus ?? null,
        trackingNumber: tracking?.number ?? null,
        trackingUrl: tracking?.url ?? null,
        lineItemsJson: node.lineItems.edges.map(({ node: li }) => ({ title: li.title, quantity: li.quantity })),
        createdAt: new Date(node.createdAt),
      },
    });
  }
}

export async function getLocations(): Promise<{ locations: { id: string; name: string }[] }> {
  const data = await shopifyGraphQL<{
    locations: { edges: { node: { id: string; name: string } }[] };
  }>(`query { locations(first: 10) { edges { node { id name } } } }`);
  return {
    locations: data.locations.edges.map(({ node }) => ({ id: node.id, name: node.name })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getInventoryLevels(_locationId: string) {
  return { inventory_levels: [] as InventoryLevel[] };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setInventoryLevel(_inventoryItemId: string, _locationId: string, _available: number) {
  // GraphQL mutation for inventory — kept as stub, implement when needed
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  status: string;
  body_html: string;
  tags: string;
  product_type: string;
  vendor: string;
  variants: ShopifyVariant[];
  images: { src: string; alt: string | null }[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price?: string | null;
  sku: string;
  inventory_quantity: number;
  inventory_item_id: number;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  phone: string | null;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_items: { title: string; quantity: number; price: string }[];
  customer: { first_name: string; last_name: string; email: string } | null;
}

export interface InventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}
