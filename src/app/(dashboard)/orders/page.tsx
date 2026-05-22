export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  PAID: "bg-green-50 text-green-700",
  PENDING: "bg-yellow-50 text-yellow-700",
  PARTIALLY_REFUNDED: "bg-orange-50 text-orange-700",
  VOIDED: "bg-zinc-100 text-zinc-500",
  REFUNDED: "bg-red-50 text-red-700",
};

export default async function OrdersPage() {
  const orders = await db.shopifyOrderCache.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Orders</h1>
        <p className="text-sm text-zinc-500 mt-1">{orders.length} orders</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No orders found. Seed the database first.</p>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Order", "Customer", "Total", "Payment", "Fulfillment", "Date"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const meta = o.lineItemsJson as { count?: number; customerName?: string };
                const parts = o.status.split(" / ");
                const paymentStatus = parts[0] ?? o.status;
                const fulfillmentStatus = parts[1] ?? "";
                return (
                  <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-zinc-600">{meta?.customerName ?? o.customerEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-900">
                      {o.totalPrice.toLocaleString()} {o.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          statusColor[paymentStatus] ?? "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          fulfillmentStatus === "FULFILLED"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {fulfillmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {format(new Date(o.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
