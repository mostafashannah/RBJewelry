"use client";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";

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

const paymentColor: Record<string, string> = {
  PAID: "bg-green-50 text-green-700",
  PENDING: "bg-yellow-50 text-yellow-700",
  PARTIALLY_REFUNDED: "bg-orange-50 text-orange-700",
  VOIDED: "bg-zinc-100 text-zinc-500",
  REFUNDED: "bg-red-50 text-red-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
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

  const paid = orders.filter(o => o.status.includes("PAID"));
  const revenue = paid.reduce((s, o) => s + o.totalPrice, 0);

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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No orders in cache. Tap Sync Orders to load.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {orders.map((o) => {
              const parts = o.status.split(" / ");
              const payment = parts[0] ?? o.status;
              const fulfillment = parts[1] ?? "";
              const meta = o.lineItemsJson;
              const items = meta?.items?.map(i => `${i.quantity}× ${i.title}`).join(", ") ?? "";
              return (
                <div key={o.id} className="bg-white border border-zinc-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-zinc-900">#{o.orderNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paymentColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-700">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                  {items && <p className="text-xs text-zinc-400 mt-0.5 truncate">{items}</p>}
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
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Order", "Customer", "Items", "Total", "Payment", "Tracking", "Date"].map((h) => (
                    <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const parts = o.status.split(" / ");
                  const payment = parts[0] ?? o.status;
                  const meta = o.lineItemsJson;
                  const items = meta?.items?.map(i => `${i.quantity}× ${i.title}`).join(", ") ?? "";
                  return (
                    <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-zinc-700 max-w-[140px]">
                        <p className="truncate">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                        {o.customerPhone && <p className="text-[10px] text-zinc-400">{o.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[180px]">
                        <p className="truncate">{items}</p>
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
