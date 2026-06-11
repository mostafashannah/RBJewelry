"use client";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { RefreshCw, PackageSearch, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

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
  lineItemsJson: { customerName?: string; items?: { title: string; quantity: number }[] };
}

interface AvailResult {
  title: string;
  quantity: number;
  found: boolean;
  inStock: number;
  reserved: number;
  sold: number;
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

function AvailBadge({ r }: { r: AvailResult }) {
  if (!r.found) return (
    <span className="flex items-center gap-1 text-[10px] text-red-600">
      <XCircle size={10} /> Not in inventory
    </span>
  );
  if (r.inStock >= r.quantity) return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
      <CheckCircle2 size={10} /> In stock ({r.inStock})
    </span>
  );
  if (r.inStock > 0) return (
    <span className="flex items-center gap-1 text-[10px] text-amber-600">
      <AlertCircle size={10} /> Low stock ({r.inStock})
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
      <AlertCircle size={10} /> Found but not in stock
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [avail, setAvail] = useState<Record<string, AvailState>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pullY, setPullY] = useState(0);
  const startYRef = useRef(0);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/shopify/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    setSyncMsg(data.ok ? "Synced from Shopify" : (data.error ?? "Sync failed"));
    if (data.ok) await load();
    setSyncing(false);
  };

  const checkAvailability = async (orderId: string, items: { title: string; quantity: number }[]) => {
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
              const itemsStr = items.map(i => `${i.quantity}× ${i.title}`).join(", ");
              const av = avail[o.id];
              return (
                <div key={o.id} className="bg-white border border-zinc-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-zinc-900">#{o.orderNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paymentColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-700">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                  {itemsStr && <p className="text-xs text-zinc-400 mt-0.5 truncate">{itemsStr}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-zinc-900">{o.totalPrice.toLocaleString()} {o.currency}</span>
                    <span className="text-xs text-zinc-400">{format(new Date(o.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {o.trackingNumber && (
                    <a href={o.trackingUrl ?? "#"} target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      Track: {o.trackingNumber}
                    </a>
                  )}
                  {fulfillment && (
                    <span className={`mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-full ${fulfillment === "FULFILLED" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {fulfillment}
                    </span>
                  )}
                  {/* Check Availability */}
                  {items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-50">
                      {!av ? (
                        <button
                          onClick={() => checkAvailability(o.id, items)}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 transition-colors">
                          <PackageSearch size={12} /> Check Inventory
                        </button>
                      ) : av.loading ? (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <RefreshCw size={11} className="animate-spin" /> Checking…
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {av.results?.map((r, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-zinc-600 truncate">{r.quantity}× {r.title}</span>
                              <AvailBadge r={r} />
                            </div>
                          ))}
                          <button onClick={() => setAvail((p) => { const n = { ...p }; delete n[o.id]; return n; })}
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
                  const itemsStr = items.map(i => `${i.quantity}× ${i.title}`).join(", ");
                  const av = avail[o.id];
                  return (
                    <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-zinc-700 max-w-[140px]">
                        <p className="truncate">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                        {o.customerPhone && <p className="text-[10px] text-zinc-400">{o.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[180px]">
                        <p className="truncate">{itemsStr}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{o.totalPrice.toLocaleString()} {o.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paymentColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.trackingNumber ? (
                          <a href={o.trackingUrl ?? "#"} target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline">{o.trackingNumber}</a>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{format(new Date(o.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-xs min-w-[160px]">
                        {items.length === 0 ? null : !av ? (
                          <button onClick={() => checkAvailability(o.id, items)}
                            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-1 hover:bg-zinc-50 transition-colors whitespace-nowrap">
                            <PackageSearch size={11} /> Check Stock
                          </button>
                        ) : av.loading ? (
                          <span className="flex items-center gap-1 text-zinc-400"><RefreshCw size={10} className="animate-spin" /> Checking…</span>
                        ) : (
                          <div className="space-y-0.5">
                            {av.results?.map((r, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <AvailBadge r={r} />
                                <span className="text-zinc-400 truncate max-w-[100px]">{r.title}</span>
                              </div>
                            ))}
                            <button onClick={() => setAvail((p) => { const n = { ...p }; delete n[o.id]; return n; })}
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
    </div>
  );
}
