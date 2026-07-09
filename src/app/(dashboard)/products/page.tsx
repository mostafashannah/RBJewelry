"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShoppingBag, Eye, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import Image from "next/image";

interface ShopifyVariantRaw {
  id?: number;
  title?: string;
  sku?: string;
  price?: string;
  inventory_quantity?: number;
}

interface Product {
  id: string;
  handle: string;
  title: string;
  priceMin: number;
  priceMax: number;
  imageUrl: string | null;
  available: boolean;
  tags: string[];
  rawJson: {
    productType?: string;
    variants?: ShopifyVariantRaw[] | { edges?: { node?: { inventoryQuantity?: number; sku?: string; title?: string } }[] };
  };
}

interface ProductAnalytics {
  orders: number;
  views: number;
}

type SortBy = "default" | "best_selling" | "most_viewed";
type DateRange = "all" | "today" | "yesterday" | "week" | "month";
type ViewMode = "grid" | "list";

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all",       label: "All Time"   },
  { key: "month",     label: "Last 30d"   },
  { key: "week",      label: "Last 7d"    },
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
];

const SORTS: { key: SortBy; label: string }[] = [
  { key: "default",      label: "Default"      },
  { key: "best_selling", label: "Best Selling"  },
  { key: "most_viewed",  label: "Most Viewed"   },
];

function getVariants(raw: Product["rawJson"]): { title: string; sku: string; qty: number }[] {
  const rawVariants = raw?.variants;
  if (Array.isArray(rawVariants)) {
    return (rawVariants as ShopifyVariantRaw[]).map((v) => ({
      title: v.title ?? "",
      sku: v.sku ?? "",
      qty: v.inventory_quantity ?? 0,
    }));
  }
  return ((rawVariants as { edges?: { node?: { inventoryQuantity?: number; sku?: string; title?: string } }[] })?.edges ?? []).map((e) => ({
    title: e?.node?.title ?? "",
    sku: e?.node?.sku ?? "",
    qty: e?.node?.inventoryQuantity ?? 0,
  }));
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts]                 = useState<Product[]>([]);
  const [analytics, setAnalytics]               = useState<Record<string, ProductAnalytics>>({});
  const [loading, setLoading]                   = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError]     = useState(false);
  const [syncing, setSyncing]                   = useState(false);
  const [syncMsg, setSyncMsg]                   = useState("");
  const [syncOk, setSyncOk]                     = useState(true);
  const [sortBy, setSortBy]                     = useState<SortBy>("default");
  const [dateRange, setDateRange]               = useState<DateRange>("all");
  const [view, setView]                         = useState<ViewMode>("grid");
  const [pullY, setPullY]                       = useState(0);
  const [pulling, setPulling]                   = useState(false);
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
      if (!res.ok || data.error) {
        setAnalyticsError(true);
      } else {
        setAnalyticsError(false);
        setAnalytics(data.analytics ?? {});
      }
    } catch { setAnalyticsError(true); }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (sortBy !== "default") loadAnalytics(dateRange);
  }, [sortBy, dateRange, loadAnalytics]);

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setSyncOk(true);
      setSyncMsg("Synced!");
      await Promise.all([loadProducts(), sortBy !== "default" ? loadAnalytics(dateRange) : Promise.resolve()]);
    } else {
      setSyncOk(false);
      const raw = String(data.error ?? "");
      setSyncMsg(raw.includes("401") || raw.includes("Invalid API") ? "Sync failed — invalid Shopify API token." : "Sync failed.");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 6000);
  };

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

  const allViewsZero = Object.keys(analytics).length > 0 &&
    Object.values(analytics).every((v) => v.views === 0);

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "best_selling") return (analytics[b.id]?.orders ?? 0) - (analytics[a.id]?.orders ?? 0);
    if (sortBy === "most_viewed") {
      if (allViewsZero) return (analytics[b.id]?.orders ?? 0) - (analytics[a.id]?.orders ?? 0);
      return (analytics[b.id]?.views ?? 0) - (analytics[a.id]?.views ?? 0);
    }
    return 0;
  });

  return (
    <div ref={mainRef} className="p-4 md:p-8 overflow-auto h-full"
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

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
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-zinc-200 rounded-xl overflow-hidden">
            <button onClick={() => setView("grid")}
              className={`p-2 transition-colors ${view === "grid" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView("list")}
              className={`p-2 transition-colors ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}>
              <List size={14} />
            </button>
          </div>
          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <p className={`text-xs rounded-lg px-4 py-2 mb-4 ${syncOk ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>{syncMsg}</p>
      )}

      {/* Sort + Date Range */}
      <div className="mb-4 flex flex-col gap-3">
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
            {!analyticsLoading && analyticsError && (
              <span className="text-[10px] text-amber-500 ml-1">Analytics unavailable</span>
            )}
            {!analyticsLoading && !analyticsError && sortBy === "most_viewed" && allViewsZero && (
              <span className="text-[10px] text-zinc-400 ml-1">views unavailable — sorted by orders</span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedProducts.map((p) => {
            const variants = getVariants(p.rawJson);
            const totalQty = variants.reduce((s, v) => s + v.qty, 0);
            const isDefault = variants.length === 1 && variants[0].title === "Default Title";
            const variantCount = isDefault ? 0 : variants.length;
            const price = p.priceMin === p.priceMax
              ? `${p.priceMin.toLocaleString()} EGP`
              : `${p.priceMin.toLocaleString()}–${p.priceMax.toLocaleString()} EGP`;
            const stat = analytics[p.id];

            return (
              <div key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="bg-white border border-zinc-100 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:border-zinc-200 transition-all">
                {p.imageUrl ? (
                  <div className="aspect-square relative bg-zinc-50">
                    <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="200px" unoptimized />
                  </div>
                ) : (
                  <div className="aspect-square bg-zinc-50 flex items-center justify-center">
                    <ShoppingBag size={28} className="text-zinc-200" />
                  </div>
                )}
                <div className="p-3 flex flex-col flex-1">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs font-semibold text-zinc-700 mt-0.5">{price}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      totalQty > 0 || p.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                    }`}>
                      {totalQty > 0 ? `${totalQty} in stock` : p.available ? "Available" : "Out of stock"}
                    </span>
                    {variantCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-500">
                        {variantCount} variant{variantCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${
                      (stat?.orders ?? 0) > 0 ? "text-zinc-700" : "text-zinc-300"
                    }`}>
                      <ShoppingBag size={10} />
                      {analyticsLoading ? "—" : analyticsError ? "—" : (stat?.orders ?? 0)}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${
                      (stat?.views ?? 0) > 0 ? "text-zinc-500" : "text-zinc-300"
                    }`}>
                      <Eye size={10} />
                      {analyticsLoading ? "—" : analyticsError ? "—" : (stat?.views ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-1">
          {sortedProducts.map((p) => {
            const variants = getVariants(p.rawJson);
            const totalQty = variants.reduce((s, v) => s + v.qty, 0);
            const isDefault = variants.length === 1 && variants[0].title === "Default Title";
            const variantCount = isDefault ? 0 : variants.length;
            const price = p.priceMin === p.priceMax
              ? `${p.priceMin.toLocaleString()} EGP`
              : `${p.priceMin.toLocaleString()}–${p.priceMax.toLocaleString()} EGP`;
            const stat = analytics[p.id];

            return (
              <div key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="bg-white border border-zinc-100 rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:shadow-sm hover:border-zinc-200 transition-all">
                {p.imageUrl ? (
                  <div className="w-12 h-12 relative bg-zinc-50 rounded-lg flex-shrink-0 overflow-hidden">
                    <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="48px" unoptimized />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-zinc-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={18} className="text-zinc-200" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{price}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {variantCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                      {variantCount}v
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    totalQty > 0 || p.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                  }`}>
                    {totalQty > 0 ? totalQty : p.available ? "In" : "Out"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-0.5 text-[10px] ${(stat?.orders ?? 0) > 0 ? "text-zinc-500" : "text-zinc-300"}`}>
                      <ShoppingBag size={9} />{analyticsLoading ? "—" : (stat?.orders ?? 0)}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[10px] ${(stat?.views ?? 0) > 0 ? "text-zinc-400" : "text-zinc-300"}`}>
                      <Eye size={9} />{analyticsLoading ? "—" : (stat?.views ?? 0)}
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
