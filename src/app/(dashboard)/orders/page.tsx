"use client";
import { useState, useEffect } from "react";
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
  fulfillmentStatus: string | null;
  shipmentStatus: string | null;
  createdAt: string;
  lineItemsJson: { customerName?: string; count?: number };
}

const statusColor: Record<string, string> = {
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
    if (data.ok) {
      setSyncMsg("Orders synced from Shopify");
      await load();
    } else {
      setSyncMsg(data.error ?? "Sync failed");
    }
    setSyncing(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Orders</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{orders.length} orders</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync from Shopify"}
        </button>
      </div>

      {syncMsg && (
        <p className="text-xs text-green-600 bg-green-50 rounded-lg px-4 py-2 mb-4">{syncMsg}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No orders. Tap Sync from Shopify to load.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {orders.map((o) => {
              const parts = o.status.split(" / ");
              const payment = parts[0] ?? o.status;
              const fulfillment = parts[1] ?? "";
              const meta = o.lineItemsJson as { customerName?: string };
              return (
                <div key={o.id} className="bg-white border border-zinc-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-zinc-900">#{o.orderNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                  </div>
                  <p className="text-sm text-zinc-600">{meta?.customerName ?? o.customerEmail ?? "—"}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium text-zinc-900">{o.totalPrice.toLocaleString()} {o.currency}</span>
                    <span className="text-xs text-zinc-400">{format(new Date(o.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {fulfillment && (
                    <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full ${fulfillment === "FULFILLED" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {fulfillment}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  {["Order", "Customer", "Total", "Payment", "Fulfillment", "Date"].map((h) => (
                    <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = o.lineItemsJson as { customerName?: string };
                  const parts = o.status.split(" / ");
                  const payment = parts[0] ?? o.status;
                  const fulfillment = parts[1] ?? "";
                  return (
                    <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-zinc-600">{meta?.customerName ?? o.customerEmail ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-900">{o.totalPrice.toLocaleString()} {o.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[payment] ?? "bg-zinc-100 text-zinc-500"}`}>{payment}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${fulfillment === "FULFILLED" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"}`}>{fulfillment}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{format(new Date(o.createdAt), "MMM d, yyyy")}</td>
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
