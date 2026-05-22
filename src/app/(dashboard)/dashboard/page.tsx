import { db } from "@/lib/db";
import { getOrders } from "@/lib/shopify/admin";
import { ConversationStatus } from "@prisma/client";

async function getStats() {
  const [openConversations, totalProducts, ordersRes] = await Promise.all([
    db.conversation.count({ where: { status: ConversationStatus.OPEN } }),
    db.shopifyProductCache.count({ where: { available: true } }),
    getOrders(50).catch(() => ({ orders: [] })),
  ]);

  const revenue = ordersRes.orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);

  return { openConversations, totalProducts, revenue, orderCount: ordersRes.orders.length };
}

export default async function DashboardPage() {
  const stats = await getStats().catch(() => ({
    openConversations: 0,
    totalProducts: 0,
    revenue: 0,
    orderCount: 0,
  }));

  const cards = [
    { label: "Open Conversations", value: stats.openConversations, sub: "Across all platforms" },
    { label: "Active Products", value: stats.totalProducts, sub: "In Shopify store" },
    { label: "Recent Orders", value: stats.orderCount, sub: "Last 50 orders" },
    { label: "Revenue (EGP)", value: `${stats.revenue.toLocaleString()} EGP`, sub: "Recent orders total" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Welcome back to RB Jewelry dashboard</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-zinc-100 rounded-xl p-5">
            <p className="text-xs text-zinc-400 mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-zinc-900">{card.value}</p>
            <p className="text-xs text-zinc-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-700 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: "Sync products to AI context", action: "/api/shopify/sync", method: "POST" },
            ].map((a) => (
              <p key={a.label} className="text-sm text-zinc-500">
                • {a.label}
              </p>
            ))}
            <p className="text-sm text-zinc-500">• View all open messages in Inbox</p>
            <p className="text-sm text-zinc-500">• Check ad performance in Ads</p>
            <p className="text-sm text-zinc-500">• Export finances to Google Sheets</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-700 mb-4">System Status</h2>
          <div className="space-y-3">
            {[
              { label: "AI Auto-Reply", status: "Configured via Settings" },
              { label: "Instagram Webhook", status: "Register in Meta Developer Console" },
              { label: "WhatsApp Webhook", status: "Register in Meta Developer Console" },
              { label: "Shopify Sync", status: "POST /api/shopify/sync to sync products" },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between">
                <span className="text-sm text-zinc-700">{item.label}</span>
                <span className="text-xs text-zinc-400 text-right max-w-[180px]">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
