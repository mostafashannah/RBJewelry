"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { RefreshCw, PackageSearch, CheckCircle2, XCircle, AlertCircle, Bookmark, X } from "lucide-react";
import type { OrderDetail } from "@/lib/shopify/admin";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  currency: string;
  customerEmail: string | null;
  customerPhone: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  lineItemsJson: { customerName?: string; items?: { title: string; quantity: number; variantTitle?: string; sku?: string }[] };
}

interface AvailResult {
  title: string;
  variantTitle: string | null;
  quantity: number;
  found: boolean;
  sizeMatched: boolean;
  inStock: number;
  reserved: number;
  sold: number;
  sku?: string;
}

interface AvailState {
  loading: boolean;
  results?: AvailResult[];
}

const paymentColor: Record<string, string> = {
  PAID: "bg-green-50 text-green-700",
  PENDING: "bg-yellow-50 text-yellow-700",
  PARTIALLY_REFUNDED: "bg-orange-50 text-orange-700",
  PARTIALLY_PAID: "bg-orange-50 text-orange-700",
  VOIDED: "bg-zinc-100 text-zinc-500",
  REFUNDED: "bg-red-50 text-red-700",
};

type StatusFilter = "all" | "unpaid" | "unfulfilled" | "paid" | "fulfilled" | "refunded" | "voided";

function isPaidStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s.includes("PAID") && !s.includes("REFUNDED");
}

function matchesFilter(status: string, f: StatusFilter) {
  const s = status.toUpperCase();
  if (f === "all") return true;
  if (f === "unpaid") return s.includes("PENDING");
  if (f === "unfulfilled") return s.includes("UNFULFILLED");
  if (f === "paid") return s.includes("PAID") && !s.includes("REFUNDED");
  if (f === "fulfilled") return s.includes("FULFILLED") && !s.includes("UNFULFILLED");
  if (f === "refunded") return s.includes("REFUNDED");
  if (f === "voided") return s.includes("VOIDED") || s.includes("CANCEL");
  return true;
}

function AvailBadge({ r, held, onHold }: { r: AvailResult; held?: boolean; onHold?: () => void }) {
  const canHold = r.found && r.inStock > 0 && onHold;
  const holdBtn = canHold && !held ? (
    <button onClick={onHold}
      className="flex items-center gap-0.5 text-[9px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-1 py-0.5 ml-1 transition-colors">
      <Bookmark size={8} /> Hold
    </button>
  ) : held ? (
    <span className="text-[9px] text-blue-600 ml-1 font-medium">Reserved ✓</span>
  ) : null;

  if (!r.found) return (
    <span className="flex items-center gap-1 text-[10px] text-red-600">
      <XCircle size={10} /> Not in inventory
    </span>
  );
  if (!r.sizeMatched) {
    if (r.inStock >= r.quantity) return (
      <span className="flex items-center gap-1 text-[10px] text-amber-500">
        <AlertCircle size={10} /> In stock ({r.inStock}), size?{holdBtn}
      </span>
    );
    if (r.inStock > 0) return (
      <span className="flex items-center gap-1 text-[10px] text-amber-600">
        <AlertCircle size={10} /> Low stock ({r.inStock}), size?{holdBtn}
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <AlertCircle size={10} /> Not in stock, size?
      </span>
    );
  }
  if (r.inStock >= r.quantity) return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
      <CheckCircle2 size={10} /> In stock ({r.inStock}){holdBtn}
    </span>
  );
  if (r.inStock > 0) return (
    <span className="flex items-center gap-1 text-[10px] text-amber-600">
      <AlertCircle size={10} /> Low stock ({r.inStock}){holdBtn}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
      <AlertCircle size={10} /> Found but not in stock
    </span>
  );
}

function formatPrice(amount: string | number, currency: string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return `0 ${currency}`;
  // Show as integer when the decimal part is .00
  const formatted = n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

function OrderDetailModal({ numericId, onClose }: { numericId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    setDetailLoading(true);
    setDetailError("");
    fetch(`/api/shopify/orders/${numericId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setDetailError(data.error);
        else setDetail(data.order);
      })
      .catch(() => setDetailError("Failed to load order details."))
      .finally(() => setDetailLoading(false));
  }, [numericId]);

  // ESC key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const hasContactInfo = detail && (detail.email || detail.phone || detail.shippingAddress);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-start justify-between rounded-t-2xl md:rounded-t-2xl z-10">
          <div>
            {detail ? (
              <>
                <h2 className="text-lg font-semibold text-zinc-900">{detail.name}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {format(new Date(detail.createdAt), "MMM d, yyyy · h:mm a")}
                </p>
              </>
            ) : detailLoading ? (
              <div className="h-6 w-24 bg-zinc-100 rounded animate-pulse" />
            ) : (
              <h2 className="text-lg font-semibold text-zinc-900">Order</h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-8 pt-4">
          {detailLoading && (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={18} className="text-zinc-300 animate-spin" />
            </div>
          )}

          {detailError && (
            <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
              {detailError}
            </div>
          )}

          {detail && (
            <div className="space-y-0">
              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${paymentColor[detail.financialStatus] ?? "bg-zinc-100 text-zinc-500"}`}>
                  {detail.financialStatus}
                </span>
                {detail.fulfillmentStatus && (
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                    detail.fulfillmentStatus.includes("FULFILLED") && !detail.fulfillmentStatus.includes("UNFULFILLED")
                      ? "bg-blue-50 text-blue-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {detail.fulfillmentStatus}
                  </span>
                )}
                {detail.tags.length > 0 && detail.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Customer / Shipping */}
              {hasContactInfo && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Customer</p>
                  <div className="space-y-1">
                    {detail.shippingAddress?.name && (
                      <p className="text-sm font-medium text-zinc-800">{detail.shippingAddress.name}</p>
                    )}
                    {detail.email && (
                      <a href={`mailto:${detail.email}`} className="block text-sm text-blue-600 hover:underline">
                        {detail.email}
                      </a>
                    )}
                    {detail.phone && (
                      <a href={`tel:${detail.phone}`} className="block text-sm text-zinc-600 hover:underline">
                        {detail.phone}
                      </a>
                    )}
                    {detail.shippingAddress && (
                      <div className="text-xs text-zinc-400 mt-1 space-y-0.5">
                        {detail.shippingAddress.address1 && <p>{detail.shippingAddress.address1}</p>}
                        {detail.shippingAddress.address2 && <p>{detail.shippingAddress.address2}</p>}
                        {(detail.shippingAddress.city || detail.shippingAddress.province || detail.shippingAddress.zip) && (
                          <p>
                            {[detail.shippingAddress.city, detail.shippingAddress.province, detail.shippingAddress.zip]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {detail.shippingAddress.country && <p>{detail.shippingAddress.country}</p>}
                        {detail.shippingAddress.phone && (
                          <a href={`tel:${detail.shippingAddress.phone}`} className="hover:underline text-zinc-500">
                            {detail.shippingAddress.phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Line Items */}
              {detail.lineItems.length > 0 && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Items</p>
                  <div className="space-y-2">
                    {detail.lineItems.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-800 font-medium leading-snug">{item.title}</p>
                          {item.variantTitle && (
                            <p className="text-xs text-zinc-400">{item.variantTitle}</p>
                          )}
                          {item.sku && (
                            <p className="text-[10px] text-zinc-300">SKU: {item.sku}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-zinc-700">
                            {item.quantity} × {formatPrice(item.unitPrice, detail.currency)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-zinc-400">= {formatPrice(item.lineTotal, detail.currency)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Totals */}
              <div className="border-t border-zinc-100 pt-4 mt-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span>{formatPrice(detail.subtotal, detail.currency)}</span>
                  </div>
                  {parseFloat(detail.shipping) > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Shipping</span>
                      <span>{formatPrice(detail.shipping, detail.currency)}</span>
                    </div>
                  )}
                  {parseFloat(detail.discounts) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discounts</span>
                      <span>−{formatPrice(detail.discounts, detail.currency)}</span>
                    </div>
                  )}
                  {parseFloat(detail.tax) > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Tax</span>
                      <span>{formatPrice(detail.tax, detail.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-zinc-900 pt-1 border-t border-zinc-100">
                    <span>Total</span>
                    <span>{formatPrice(detail.total, detail.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Payment / Transactions */}
              {detail.transactions.length > 0 && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Payment</p>
                  <div className="space-y-1.5">
                    {detail.transactions.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-600 capitalize">{t.gateway.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            t.status === "SUCCESS" ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {t.status}
                          </span>
                          <span className="text-zinc-700">{formatPrice(t.amount, detail.currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fulfillments */}
              {detail.fulfillments.length > 0 && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Fulfillment</p>
                  <div className="space-y-2">
                    {detail.fulfillments.map((f, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            f.status === "SUCCESS" || f.status === "FULFILLED"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {f.status}
                          </span>
                          {f.company && <span className="text-xs text-zinc-400">{f.company}</span>}
                        </div>
                        {f.trackingNumber && (
                          <div className="mt-1">
                            {f.trackingUrl ? (
                              <a
                                href={f.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Track: {f.trackingNumber}
                              </a>
                            ) : (
                              <span className="text-xs text-zinc-500">{f.trackingNumber}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount codes */}
              {detail.discountCodes.length > 0 && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Discount Codes</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.discountCodes.map((code, i) => (
                      <span key={i} className="text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-700">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              {detail.note && (
                <div className="border-t border-zinc-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Note</p>
                  <p className="text-sm text-zinc-500 bg-zinc-50 rounded-xl px-4 py-3 leading-relaxed">
                    {detail.note}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [avail, setAvail] = useState<Record<string, AvailState>>({});
  const [heldItems, setHeldItems] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pullY, setPullY] = useState(0);
  const startYRef = useRef(0);
  const [skuInventory, setSkuInventory] = useState<Record<string, AvailResult>>({});

  // Order detail modal state
  const [selectedOrderNumericId, setSelectedOrderNumericId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Order[]> => {
    setLoading(true);
    const res = await fetch("/api/shopify/orders");
    const data = await res.json();
    const fetched: Order[] = data.orders ?? [];
    setOrders(fetched);
    setLoading(false);
    return fetched;
  }, []);

  const autoCheckSKUs = useCallback(async (orderList: Order[]) => {
    const seenSkus = new Set<string>();
    const skuItems: Array<{ title: string; quantity: number; variantTitle?: string; sku: string }> = [];
    for (const o of orderList) {
      if (isPaidStatus(o.status)) continue; // paid orders are already done, no need to check inventory
      for (const item of (o.lineItemsJson?.items ?? [])) {
        if (item.sku && !seenSkus.has(item.sku)) {
          seenSkus.add(item.sku);
          skuItems.push({ title: item.title, quantity: 1, variantTitle: item.variantTitle, sku: item.sku });
        }
      }
    }
    if (skuItems.length === 0) return;
    const res = await fetch("/api/inventory/check-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: skuItems }),
    });
    const data = await res.json();
    const map: Record<string, AvailResult> = {};
    (data.results as AvailResult[]).forEach((r: AvailResult, i: number) => { map[skuItems[i].sku] = r; });
    setSkuInventory(map);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    setSyncMsg(data.ok ? "Synced from Shopify" : (data.error ?? "Sync failed"));
    if (data.ok) { const fetched = await load(); autoCheckSKUs(fetched); }
    setSyncing(false);
  }, [load, autoCheckSKUs]);

  useEffect(() => {
    load().then((fetched) => {
      if (fetched.length === 0) sync();
      else autoCheckSKUs(fetched);
    });
  }, [load, sync, autoCheckSKUs]);

  const openDetail = (numericId: string) => {
    setSelectedOrderNumericId(numericId);
  };

  const closeDetail = () => {
    setSelectedOrderNumericId(null);
  };

  const checkAvailability = async (orderId: string, items: { title: string; quantity: number; variantTitle?: string; sku?: string }[]) => {
    if (!items.length) return;
    setAvail((prev) => ({ ...prev, [orderId]: { loading: true } }));
    const res = await fetch("/api/inventory/check-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    setAvail((prev) => ({ ...prev, [orderId]: { loading: false, results: data.results ?? [] } }));
  };

  const holdItem = async (orderNumber: string, title: string, variantTitle: string | null | undefined, sku?: string) => {
    const key = `${orderNumber}:${title}:${variantTitle ?? ""}`;
    const confirmed = window.confirm(`Hold "${title}${variantTitle ? ` (${variantTitle})` : ""}" for order #${orderNumber}?`);
    if (!confirmed) return;
    const res = await fetch("/api/inventory/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, variantTitle: variantTitle ?? undefined, orderNumber, sku: sku ?? undefined }),
    });
    if (res.ok) {
      setHeldItems((prev) => ({ ...prev, [key]: true }));
    } else {
      const d = await res.json();
      alert(d.error ?? "Could not reserve item.");
    }
  };

  const paid = orders.filter(o => o.status.toUpperCase().includes("PAID") && !o.status.toUpperCase().includes("REFUNDED"));
  const revenue = paid.reduce((s, o) => s + o.totalPrice, 0);

  const counts: Record<StatusFilter, number> = {
    all: orders.length,
    unpaid: orders.filter(o => matchesFilter(o.status, "unpaid")).length,
    unfulfilled: orders.filter(o => matchesFilter(o.status, "unfulfilled")).length,
    paid: orders.filter(o => matchesFilter(o.status, "paid")).length,
    fulfilled: orders.filter(o => matchesFilter(o.status, "fulfilled")).length,
    refunded: orders.filter(o => matchesFilter(o.status, "refunded")).length,
    voided: orders.filter(o => matchesFilter(o.status, "voided")).length,
  };

  const totals: Record<StatusFilter, number> = {
    all: orders.reduce((s, o) => s + o.totalPrice, 0),
    unpaid: orders.filter(o => matchesFilter(o.status, "unpaid")).reduce((s, o) => s + o.totalPrice, 0),
    unfulfilled: orders.filter(o => matchesFilter(o.status, "unfulfilled")).reduce((s, o) => s + o.totalPrice, 0),
    paid: orders.filter(o => matchesFilter(o.status, "paid")).reduce((s, o) => s + o.totalPrice, 0),
    fulfilled: orders.filter(o => matchesFilter(o.status, "fulfilled")).reduce((s, o) => s + o.totalPrice, 0),
    refunded: orders.filter(o => matchesFilter(o.status, "refunded")).reduce((s, o) => s + o.totalPrice, 0),
    voided: orders.filter(o => matchesFilter(o.status, "voided")).reduce((s, o) => s + o.totalPrice, 0),
  };

  const FILTERS: { key: StatusFilter; label: string; color: string }[] = [
    { key: "all",         label: "All",         color: "bg-zinc-900 text-white" },
    { key: "unpaid",      label: "Unpaid",       color: "bg-yellow-100 text-yellow-800" },
    { key: "unfulfilled", label: "Unfulfilled",  color: "bg-orange-100 text-orange-800" },
    { key: "paid",        label: "Paid",         color: "bg-green-100 text-green-800" },
    { key: "fulfilled",   label: "Fulfilled",    color: "bg-blue-100 text-blue-800" },
    { key: "refunded",    label: "Returned",     color: "bg-red-100 text-red-800" },
    { key: "voided",      label: "Cancelled",    color: "bg-zinc-100 text-zinc-500" },
  ];

  const visibleOrders = statusFilter === "all" ? orders : orders.filter(o => matchesFilter(o.status, statusFilter));

  return (
    <div className="p-4 md:p-8"
      onTouchStart={(e) => { if ((e.currentTarget.closest("main") as HTMLElement|null)?.scrollTop === 0) startYRef.current = e.touches[0].clientY; }}
      onTouchMove={(e) => { const dy = e.touches[0].clientY - startYRef.current; if (dy > 0 && ((e.currentTarget.closest("main") as HTMLElement|null)?.scrollTop ?? 0) === 0) setPullY(Math.min(dy, 80)); }}
      onTouchEnd={async () => { if (pullY > 50) { setPullY(0); await sync(); } else setPullY(0); }}
    >
      {pullY > 10 && (
        <div className="flex justify-center mb-2" style={{ marginTop: pullY - 40 }}>
          <RefreshCw size={16} className={`text-zinc-400 ${pullY > 50 ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${pullY * 4}deg)` }} />
        </div>
      )}
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Orders</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {orders.length} orders · {paid.length} paid · {revenue.toLocaleString()} EGP revenue
          </p>
        </div>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors">
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync Orders"}
        </button>
      </div>

      {syncMsg && (
        <p className={`text-xs rounded-lg px-4 py-2 mb-4 ${syncMsg.includes("fail") || syncMsg.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
          {syncMsg}
        </p>
      )}

      {/* Status filter pills with counts */}
      {!loading && orders.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1">
          {FILTERS.map(({ key, label, color }) => counts[key] > 0 || key === "all" ? (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`flex flex-col items-start px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${
                statusFilter === key
                  ? `${color} border-transparent font-medium`
                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  statusFilter === key ? "bg-white/30" : "bg-zinc-100 text-zinc-600"
                }`}>
                  {counts[key]}
                </span>
              </div>
              {totals[key] > 0 && (
                <span className={`text-[10px] mt-0.5 font-medium ${statusFilter === key ? "opacity-80" : "text-zinc-400"}`}>
                  {totals[key].toLocaleString()} EGP
                </span>
              )}
            </button>
          ) : null)}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No orders in cache. Tap Sync Orders to load.</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No {statusFilter} orders.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visibleOrders.map((o) => {
              const parts = o.status.split(" / ");
              const payment = parts[0] ?? o.status;
              const fulfillment = parts[1] ?? "";
              const meta = o.lineItemsJson;
              const items = meta?.items ?? [];
              const av = avail[o.id];
              const numericId = o.id.replace("gid://shopify/Order/", "");
              const pending = !isPaidStatus(o.status);
              return (
                <div
                  key={o.id}
                  className="bg-white border border-zinc-100 rounded-xl p-4 cursor-pointer hover:border-zinc-200 hover:shadow-sm transition-all"
                  onClick={() => openDetail(numericId)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-zinc-900">#{o.orderNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paymentColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-700">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                  {items.length > 0 && (
                    <div className="mt-0.5 space-y-1">
                      {items.map((item, idx) => {
                        const skuResult = pending && item.sku ? skuInventory[item.sku] : undefined;
                        const hKey = `${o.orderNumber}:${item.title}:${item.variantTitle ?? ""}`;
                        return (
                          <div key={idx}>
                            <p className="text-xs text-zinc-400 truncate">{item.quantity}× {item.title}{item.variantTitle ? ` (${item.variantTitle})` : ""}</p>
                            {item.sku && <p className="text-[10px] text-zinc-300">SKU: {item.sku}</p>}
                            {skuResult && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <AvailBadge r={skuResult} held={heldItems[hKey]}
                                  onHold={() => holdItem(o.orderNumber, item.title, item.variantTitle, item.sku)} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-zinc-900">{o.totalPrice.toLocaleString()} {o.currency}</span>
                    <span className="text-xs text-zinc-400">{format(new Date(o.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {o.trackingNumber && (
                    <a href={o.trackingUrl ?? "#"} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      Track: {o.trackingNumber}
                    </a>
                  )}
                  {fulfillment && (
                    <span className={`mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-full ${fulfillment === "FULFILLED" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {fulfillment}
                    </span>
                  )}
                  {/* Check Availability - only for pending/unpaid orders with items lacking SKU coverage */}
                  {pending && items.some(item => !item.sku || !skuInventory[item.sku]) && (
                    <div className="mt-3 pt-3 border-t border-zinc-50" onClick={(e) => e.stopPropagation()}>
                      {!av ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); checkAvailability(o.id, items); }}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 transition-colors">
                          <PackageSearch size={12} /> Check Inventory
                        </button>
                      ) : av.loading ? (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <RefreshCw size={11} className="animate-spin" /> Checking…
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {av.results?.map((r, i) => {
                            const hKey = `${o.orderNumber}:${r.title}:${r.variantTitle ?? ""}`;
                            return (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-zinc-600 truncate">
                                  {r.quantity}× {r.title}{r.variantTitle ? ` (${r.variantTitle})` : ""}
                                </span>
                                <AvailBadge r={r} held={heldItems[hKey]}
                                  onHold={() => holdItem(o.orderNumber, r.title, r.variantTitle, r.sku)} />
                              </div>
                            );
                          })}
                          <button onClick={(e) => { e.stopPropagation(); setAvail((p) => { const n = { ...p }; delete n[o.id]; return n; }); }}
                            className="text-[10px] text-zinc-400 underline mt-0.5">clear</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Order", "Customer", "Items", "Total", "Payment", "Tracking", "Date", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => {
                  const parts = o.status.split(" / ");
                  const payment = parts[0] ?? o.status;
                  const meta = o.lineItemsJson;
                  const items = meta?.items ?? [];
                  const av = avail[o.id];
                  const numericId = o.id.replace("gid://shopify/Order/", "");
                  const pending = !isPaidStatus(o.status);
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors cursor-pointer"
                      onClick={() => openDetail(numericId)}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-zinc-700 max-w-[140px]">
                        <p className="truncate">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                        {o.customerPhone && <p className="text-[10px] text-zinc-400">{o.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[180px]">
                        {items.map((item, idx) => {
                          const skuResult = pending && item.sku ? skuInventory[item.sku] : undefined;
                          const hKey = `${o.orderNumber}:${item.title}:${item.variantTitle ?? ""}`;
                          return (
                            <div key={idx}>
                              <p className="truncate">{item.quantity}× {item.title}{item.variantTitle ? ` (${item.variantTitle})` : ""}</p>
                              {item.sku && <p className="text-[10px] text-zinc-300 truncate">SKU: {item.sku}</p>}
                              {skuResult && (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <AvailBadge r={skuResult} held={heldItems[hKey]}
                                    onHold={() => holdItem(o.orderNumber, item.title, item.variantTitle, item.sku)} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{o.totalPrice.toLocaleString()} {o.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paymentColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                      </td>
                      <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        {o.trackingNumber ? (
                          <a href={o.trackingUrl ?? "#"} target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline">{o.trackingNumber}</a>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{format(new Date(o.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-xs min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                        {!pending || items.length === 0 || items.every(item => item.sku && skuInventory[item.sku]) ? null : !av ? (
                          <button onClick={(e) => { e.stopPropagation(); checkAvailability(o.id, items); }}
                            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-1 hover:bg-zinc-50 transition-colors whitespace-nowrap">
                            <PackageSearch size={11} /> Check Stock
                          </button>
                        ) : av.loading ? (
                          <span className="flex items-center gap-1 text-zinc-400"><RefreshCw size={10} className="animate-spin" /> Checking…</span>
                        ) : (
                          <div className="space-y-0.5">
                            {av.results?.map((r, i) => {
                              const hKey = `${o.orderNumber}:${r.title}:${r.variantTitle ?? ""}`;
                              return (
                                <div key={i} className="flex items-center gap-1.5 flex-wrap">
                                  <AvailBadge r={r} held={heldItems[hKey]}
                                    onHold={() => holdItem(o.orderNumber, r.title, r.variantTitle, r.sku)} />
                                  <span className="text-zinc-400 truncate max-w-[120px]">
                                    {r.title}{r.variantTitle ? ` (${r.variantTitle})` : ""}
                                  </span>
                                </div>
                              );
                            })}
                            <button onClick={(e) => { e.stopPropagation(); setAvail((p) => { const n = { ...p }; delete n[o.id]; return n; }); }}
                              className="text-[10px] text-zinc-400 underline">clear</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrderNumericId !== null && (
        <OrderDetailModal
          numericId={selectedOrderNumericId}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
