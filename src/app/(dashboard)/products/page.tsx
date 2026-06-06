"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const startYRef = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shopify/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) { setSyncMsg("Synced!"); await load(); }
    else setSyncMsg(data.error ?? "Sync failed");
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

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <RefreshCw size={16} className="text-zinc-300 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => {
            const raw = p.rawJson as { productType?: string; variants?: { edges?: { node?: { inventoryQuantity?: number } }[] }[] };
            const variantNodes = (raw as { variants?: { edges?: { node?: { inventoryQuantity?: number } }[] } })?.variants?.edges ?? [];
            const totalQty = variantNodes.reduce((s, v) => s + (v?.node?.inventoryQuantity ?? 0), 0);
            const price = p.priceMin === p.priceMax
              ? `${p.priceMin.toLocaleString()} EGP`
              : `${p.priceMin.toLocaleString()}–${p.priceMax.toLocaleString()} EGP`;
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
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      totalQty > 0 || p.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                    }`}>
                      {totalQty > 0 ? `${totalQty} in stock` : p.available ? "Available" : "Out of stock"}
                    </span>
                    {(raw as { productType?: string })?.productType && (
                      <span className="text-[10px] text-zinc-400">{(raw as { productType?: string }).productType}</span>
                    )}
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
