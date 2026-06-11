import { db } from "@/lib/db";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = "2025-01";

// Client-credentials token cache (expires ~24h)
let _ccToken: string | null = null;
let _ccExpires = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  // Use client credentials grant if available (auto-refreshing, no manual token needed)
  if (clientId && clientSecret) {
    if (_ccToken && Date.now() < _ccExpires - 60_000) return _ccToken;
    const shop = SHOPIFY_DOMAIN.replace(".myshopify.com", "");
    const res = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
    });
    if (res.ok) {
      const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number };
      _ccToken = access_token;
      _ccExpires = Date.now() + expires_in * 1000;
      return access_token;
    }
  }

  // Fall back to stored OAuth token or env var
  const config = await db.shopifyConfig.findFirst({ where: { shop: SHOPIFY_DOMAIN } });
  if (config?.accessToken) return config.accessToken;
  const envToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (envToken) return envToken;
  throw new Error("Shopify not connected.");
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
          shippingAddress { firstName lastName phone }
          lineItems(first: 20) {
            edges { node { title quantity originalUnitPriceSet { shopMoney { amount } } } }
          }
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
      shippingAddress: { firstName: string; lastName: string; phone: string } | null;
      lineItems: { edges: { node: { title: string; quantity: number; originalUnitPriceSet: { shopMoney: { amount: string } } } }[] };
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
    customer: node.shippingAddress
      ? { first_name: node.shippingAddress.firstName, last_name: node.shippingAddress.lastName, email: node.email }
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
      fulfillments: { status: string; updatedAt: string; trackingInfo: { number: string; url: string }[] }[];
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
      
      trackingNumber: r.trackingNumber ?? null,
      trackingUrl: r.trackingUrl ?? null,
    };
  });
}

type OrderNode = {
  id: string; name: string; email: string | null; phone: string | null;
  displayFinancialStatus: string; displayFulfillmentStatus: string | null; createdAt: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  shippingAddress: { firstName: string; lastName: string; phone: string } | null;
  lineItems: { edges: { node: { title: string; quantity: number } }[] };
  fulfillments: { status: string; trackingInfo: { number: string; url: string }[] }[];
};

const ORDER_FIELDS = `
  id name email phone createdAt
  displayFinancialStatus displayFulfillmentStatus
  totalPriceSet { shopMoney { amount currencyCode } }
  shippingAddress { firstName lastName phone }
  lineItems(first: 20) { edges { node { title quantity } } }
  fulfillments(first: 5) { status trackingInfo { number url } }
`;

async function upsertOrderNode(node: OrderNode) {
  const lastFulfillment = node.fulfillments[node.fulfillments.length - 1] ?? null;
  const tracking = lastFulfillment?.trackingInfo?.[0] ?? null;
  const shipping = node.shippingAddress as { firstName?: string; lastName?: string; phone?: string } | null;
  const customerName = shipping ? `${shipping.firstName ?? ""} ${shipping.lastName ?? ""}`.trim() : null;
  const payment = node.displayFinancialStatus as string;
  const fulfillment = node.displayFulfillmentStatus as string ?? null;
  const status = `${payment} / ${fulfillment ?? "UNFULFILLED"}`;

  await db.shopifyOrderCache.upsert({
    where: { id: node.id },
    update: {
      status, fulfillmentStatus: fulfillment,
      trackingNumber: tracking?.number ?? null, trackingUrl: tracking?.url ?? null,
      lineItemsJson: { customerName, items: node.lineItems.edges.map(({ node: li }) => ({ title: li.title, quantity: li.quantity })) },
      syncedAt: new Date(),
    },
    create: {
      id: node.id, orderNumber: node.name.replace("#", ""),
      customerEmail: node.email ?? null,
      customerPhone: (node.phone as string | null) ?? shipping?.phone ?? null,
      totalPrice: parseFloat(node.totalPriceSet.shopMoney.amount),
      currency: node.totalPriceSet.shopMoney.currencyCode,
      status, fulfillmentStatus: fulfillment,
      trackingNumber: tracking?.number ?? null, trackingUrl: tracking?.url ?? null,
      lineItemsJson: { customerName, items: node.lineItems.edges.map(({ node: li }) => ({ title: li.title, quantity: li.quantity })) },
      createdAt: new Date(node.createdAt),
    },
  });
}

export async function syncOrdersToCache() {
  let cursor: string | null = null;
  let hasNextPage = true;
  let totalSynced = 0;

  while (hasNextPage) {
    const afterClause: string = cursor ? `, after: "${cursor}"` : "";
    const data = await shopifyGraphQL<{
      orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; edges: { node: OrderNode }[] };
    }>(`
      query {
        orders(first: 250${afterClause}, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges { node { ${ORDER_FIELDS} } }
        }
      }
    `);

    for (const { node } of data.orders.edges) {
      await upsertOrderNode(node);
      totalSynced++;
    }

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  return totalSynced;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export type AnalyticsRange = "all" | "today" | "yesterday" | "week" | "month";

function shopifyqlDateClause(range: AnalyticsRange): string {
  switch (range) {
    case "today":     return " SINCE today UNTIL today";
    case "yesterday": return " SINCE -1d UNTIL -1d";
    case "week":      return " SINCE -6d UNTIL today";
    case "month":     return " SINCE -29d UNTIL today";
    default:          return "";
  }
}

function dbDateFilter(range: AnalyticsRange): { gte?: Date; lt?: Date } | undefined {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { gte: start };
    }
    case "yesterday": {
      const start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(0, 0, 0, 0);
      return { gte: start, lt: end };
    }
    case "week": {
      const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { gte: start };
    }
    case "month": {
      const start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
      return { gte: start };
    }
    default: return undefined;
  }
}

async function shopifyqlViews(range: AnalyticsRange): Promise<Map<string, number>> {
  const dateClause = shopifyqlDateClause(range);
  // Shopify ShopifyQL sessions table uses landing_page_path (not landing_page_url)
  const q = `FROM sessions SHOW sessions GROUP BY landing_page_path ORDER BY sessions DESC LIMIT 250${dateClause}`;

  try {
    const data = await shopifyGraphQL<{
      shopifyqlTableQuery?: {
        tableData?: {
          columnHeaders: { name: string }[];
          rowData?: string[][];
          unformattedData?: string[][];
        };
        parseErrors?: { code: string; message: string }[];
      };
    }>(`
      mutation ShopifyqlViews($q: String!) {
        shopifyqlTableQuery(query: $q) {
          tableData { columnHeaders { name } rowData unformattedData }
          parseErrors { code message }
        }
      }
    `, { q });

    const parseErrors = data?.shopifyqlTableQuery?.parseErrors;
    if (parseErrors?.length) {
      console.error("ShopifyQL parse errors:", JSON.stringify(parseErrors));
      return new Map();
    }

    const td = data?.shopifyqlTableQuery?.tableData;
    if (!td) return new Map();

    const headers = td.columnHeaders.map((h) => h.name);
    // Accept both landing_page_path and landing_page_url
    const urlIdx = headers.indexOf("landing_page_path") !== -1
      ? headers.indexOf("landing_page_path")
      : headers.indexOf("landing_page_url");
    const sessIdx = headers.indexOf("sessions");

    if (urlIdx === -1 || sessIdx === -1) {
      console.error("ShopifyQL sessions: unexpected headers:", headers);
      return new Map();
    }

    const rows: string[][] = td.rowData ?? td.unformattedData ?? [];

    const views = new Map<string, number>();
    for (const row of rows) {
      const url = String(row[urlIdx] ?? "");
      const match = url.match(/\/products\/([^/?#]+)/);
      if (match) {
        const handle = match[1];
        views.set(handle, (views.get(handle) ?? 0) + parseInt(row[sessIdx] ?? "0", 10));
      }
    }
    return views;
  } catch (err) {
    console.error("shopifyqlViews error:", err);
    return new Map();
  }
}

async function dbOrderCounts(range: AnalyticsRange): Promise<Map<string, number>> {
  const dateFilter = dbDateFilter(range);
  const orders = await db.shopifyOrderCache.findMany({
    where: dateFilter ? { createdAt: dateFilter } : undefined,
    select: { lineItemsJson: true },
  });

  const counts = new Map<string, number>();
  for (const order of orders) {
    const json = order.lineItemsJson as { items?: { title: string; quantity?: number }[] };
    for (const item of json?.items ?? []) {
      if (item.title) counts.set(item.title, (counts.get(item.title) ?? 0) + (item.quantity ?? 1));
    }
  }
  return counts;
}

export async function getProductRawAnalytics(range: AnalyticsRange = "all"): Promise<{
  orderCounts: Map<string, number>;   // keyed by product title
  viewsByHandle: Map<string, number>; // keyed by product handle
}> {
  const [orderCounts, viewsByHandle] = await Promise.all([
    dbOrderCounts(range),
    shopifyqlViews(range),
  ]);
  return { orderCounts, viewsByHandle };
}

export async function getLocations(): Promise<{ locations: { id: string; name: string }[] }> {
  const data = await shopifyGraphQL<{
    locations: { edges: { node: { id: string; name: string } }[] };
  }>(`query { locations(first: 10) { edges { node { id name } } } }`);
  return {
    locations: data.locations.edges.map(({ node }) => ({ id: node.id, name: node.name })),
  };
}

export async function getInventoryLevels(locationId: string) {
  const locGid = locationId.startsWith("gid://") ? locationId : `gid://shopify/Location/${locationId}`;
  const data = await shopifyGraphQL<{
    location: {
      inventoryLevels: {
        edges: { node: { item: { id: string }; quantities: { quantity: number }[] } }[];
      };
    };
  }>(`
    query getInventoryLevels($locationId: ID!) {
      location(id: $locationId) {
        inventoryLevels(first: 250) {
          edges {
            node {
              item { id }
              quantities(names: ["available"]) { quantity }
            }
          }
        }
      }
    }
  `, { locationId: locGid });

  const numericLocId = parseInt(locationId.replace("gid://shopify/Location/", ""));
  const inventory_levels: InventoryLevel[] = data.location.inventoryLevels.edges.map(({ node }) => ({
    inventory_item_id: parseInt(node.item.id.replace("gid://shopify/InventoryItem/", "")),
    location_id: numericLocId,
    available: node.quantities[0]?.quantity ?? 0,
  }));

  return { inventory_levels };
}

export async function setInventoryLevel(inventoryItemId: string, locationId: string, available: number) {
  const itemGid = inventoryItemId.startsWith("gid://")
    ? inventoryItemId
    : `gid://shopify/InventoryItem/${inventoryItemId}`;
  const locGid = locationId.startsWith("gid://")
    ? locationId
    : `gid://shopify/Location/${locationId}`;

  await shopifyGraphQL<{ inventorySetQuantities: { userErrors: { field: string[]; message: string }[] } }>(`
    mutation setInventory($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }
  `, {
    input: {
      name: "available",
      reason: "correction",
      quantities: [{ inventoryItemId: itemGid, locationId: locGid, quantity: available }],
    },
  });
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
