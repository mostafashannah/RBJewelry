import { getOrders } from "@/lib/shopify/admin";
import { format } from "date-fns";

export const revalidate = 60;

const statusColor: Record<string, string> = {
  paid: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  refunded: "bg-red-50 text-red-700",
  voided: "bg-zinc-100 text-zinc-500",
};

export default async function OrdersPage() {
  let orders: Awaited<ReturnType<typeof getOrders>>["orders"] = [];
  try {
    const data = await getOrders(50);
    orders = data.orders;
  } catch {
    /* empty state */
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Orders</h1>
        <p className="text-sm text-zinc-500 mt-1">{orders.length} recent orders</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-20">No orders found.</p>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Order", "Customer", "Items", "Total", "Status", "Date"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">#{o.order_number}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : o.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {o.line_items.slice(0, 2).map((li) => li.title).join(", ")}
                    {o.line_items.length > 2 && " …"}
                  </td>
                  <td className="px-4 py-3 text-zinc-900">
                    {parseFloat(o.total_price).toLocaleString()} {o.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        statusColor[o.financial_status] ?? "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {o.financial_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {format(new Date(o.created_at), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
