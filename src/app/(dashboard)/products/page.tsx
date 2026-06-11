"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, ShoppingBag, Eye, ArrowUpDown } from "lucide-react";
import Image from "next/image";

interface Product {
  id: string;
  handle: string;
  title: string;
  priceMin: number;
  priceMax: number;
  imageUrl: string | null;
  available: boolean;
  tags: string[];
  rawJson: { productType?: string; variants?: { edges?: { node?: { inventoryQuantity?: number } }[] }[] };
}

interface ProductAnalytics {
  orders: number;
  views: number;
}

type SortBy = "default" | "best_selling" | "most_viewed";
type DateRange = "all" | "today" | "yesterday" | "week" | "month";

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all",       label: "All Time"   },
  { key: "month",     label: "Last 30d"   },
  { key: "week",      label: "Last 7d"    },
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
];

const SORTS: { key: SortBy; label: string }[] = [
  { key: "default",     label: "Default"      },
  { key: "best_selling", label: "Best Selling" },
  { key: "most_viewed", label: "Most Viewed"   },
];

export default function ProductsPage() {
  const [products, setProducts]             = useState<Product[]>([]);
  const [analytics, setAnalytics]           = useState<Record<string, ProductAnalytics>>({});
  const [loading, setLoading]               = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncMsg, setSyncMsg]               = useState("");
  const [sortBy, setSortBy]                 = useState<SortBy>("default");
  const [dateRange, setDateRange]           = useState<DateRange>("all");
  const [pullY, setPullY]                   = useState(0);
  const [pulling, setPulling]               = useState(false);
  const startYRef = useRef(0);
  const mainRef   = useRef<HTMLDivElement>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shopify/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  const loadAnalytics = useCallback(async (range: DateRange) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/shopify/product-analytics?range=${range}`);
      const data = await res.json();
      setAnalytics(data.analytics ?? {});
    } catch { /* leave stale */ }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadAnalytics(dateRange); }, [dateRange, loadAnalytics]);

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setSyncMsg("Synced!");
      await Promise.all([loadProducts(), loadAnalytics(dateRange)]);
    } else setSyncMsg(data.error ?? "Sync failed");
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  };

  // Pull to refresh
  const onTouchStart = (e: React.TouchEvent) => {
    if ((mainRef.current?.scrollTop ?? 0) === 0) startYRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0 && (mainRef.current?.scrollTop ?? 0) === 0) { setPulling(true); setPullY(Math.min(dy, 80)); }
  };
  const onTouchEnd = async () => {
    if (pullY > 50) { setPullY(0); setPulling(false); await sync(); }
    else { setPullY(0); setPulling(false); }
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "best_selling") {
      return (analytics[b.id]?.orders ?? 0) - (analytics[a.id]?.orders ?? 0);
    }
    if (sortBy === "most_viewed") {
      return (analytics[b.id]?.views ?? 0) - (analytics[a.id]?.views ?? 0);
    }
    return 0;
  });

  return (
    <div ref={mainRef} className="p-4 md:p-8 overflow-auto h-full"
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* Pull indicator */}
      {pulling && (
        <div className="flex justify-center mb-2" style={{ marginTop: pullY - 40 }}>
          <RefreshCw size={16} className={`text-zinc-400 transition-transform ${pullY > 50 ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${pullY * 4}deg)` }} />
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{products.length} products from Shopify</p>
        </div>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors">
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync Products"}
        </button>
      </div>

      {syncMsg && (
        <p className="text-xs text-green-600 bg-green-50 rounded-lg px-4 py-2 mb-4">{syncMsg}</p>
      )}

      {/* Sort + Date Range Controls */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
            <ArrowUpDown size={11} /> Sort
          </span>
          {SORTS.map(({ key, label }) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                sortBy === key
                  ? "bg-zinc-900 text-white border-zinc-900 font-medium"
                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Date range — visible when any sort is active */}
        {sortBy !== "default" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 font-medium w-9">When</span>
            {DATE_RANGES.map(({ key, label }) => (
              <button key={key} onClick={() => setDateRange(key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  dateRange === key
                    ? "bg-amber-50 text-amber-800 border-amber-200 font-medium"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}>
                {label}
              </button>
            ))}
            {analyticsLoading && <RefreshCw size={11} className="text-zinc-300 animate-spin ml-1" />}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedProducts.map((p) => {
            const raw = p.rawJson as { productType?: string; variants?: { edges?: { node?: { inventoryQuantity?: number } }[] } };
            const variantNodes = raw?.variants?.edges ?? [];
            const totalQty = variantNodes.reduce((s, v) => s + (v?.node?.inventoryQuantity ?? 0), 0);
            const price = p.priceMin === p.priceMax
              ? `${p.priceMin.toLocaleString()} EGP`
              : `${p.priceMin.toLocaleString()}–${p.priceMax.toLocaleString()} EGP`;

            const stat = analytics[p.id];
            const orders = stat?.orders ?? 0;
            const views  = stat?.views  ?? 0;

            return (
              <div key={p.id} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                {p.imageUrl && (
                  <div className="aspect-square relative bg-zinc-50">
                    <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="200px" unoptimized />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs font-semibold text-zinc-700 mt-0.5">{price}</p>

                  {/* Stock + type */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      totalQty > 0 || p.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                    }`}>
                      {totalQty > 0 ? `${totalQty} in stock` : p.available ? "Available" : "Out of stock"}
                    </span>
                    {raw?.productType && (
                      <span className="text-[10px] text-zinc-400">{raw.productType}</span>
                    )}
                  </div>

                  {/* Analytics badges */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-50">
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${
                      orders > 0 ? "text-zinc-700" : "text-zinc-300"
                    }`}>
                      <ShoppingBag size={10} />
                      {analyticsLoading && !stat ? "—" : orders}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${
                      views > 0 ? "text-zinc-500" : "text-zinc-300"
                    }`}>
                      <Eye size={10} />
                      {analyticsLoading && !stat ? "—" : views}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
