"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Camera, X, Scale, Tag, Package, Loader2, CheckCircle,
  Trash2, Edit2, Upload, FileSpreadsheet, Sparkles, AlertCircle,
  TrendingUp, RefreshCw, Hash, ShoppingBag, LayoutGrid, List, Download, Search,
} from "lucide-react";

const CATEGORIES = ["Ring", "Necklace", "Bracelet", "Earrings", "Anklet", "Set", "Other"];
const MATERIALS = ["Sterling Silver", "Gold-Plated Silver", "Rose Gold-Plated", "18K Gold", "Other"];
const COLORS_LIST = ["Silver", "Gold", "Rose Gold", "Black", "White", "Blue", "Red", "Green", "Purple", "Mixed"];
const STATUSES = ["IN_STOCK", "SOLD", "RESERVED", "DAMAGED"] as const;
const STATUS_LABELS: Record<string, string> = { IN_STOCK: "In Stock", SOLD: "Sold", RESERVED: "Reserved", DAMAGED: "Damaged" };
const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-700",
  SOLD: "bg-zinc-100 text-zinc-500",
  RESERVED: "bg-amber-50 text-amber-700",
  DAMAGED: "bg-red-50 text-red-600",
};

interface Item {
  id: string; name: string; sku: string | null; category: string; material: string;
  weightG: number; colors: string[]; size: string | null; quantity: number; costEGP: number | null;
  priceEGP: number | null; photoUrl: string | null; status: string;
  orderNo: string | null; notes: string | null; createdAt: string;
}

interface SilverData {
  totalItems: number; totalWeightG: number; pureSilverG: number;
  totalListingValueEGP: number;
  spot: { pricePerOzUSD: number; pricePerGramUSD: number; silverValueUSD: number } | null;
}

const emptyForm = {
  name: "", sku: "", category: CATEGORIES[0], material: MATERIALS[0],
  weightG: "", colors: [] as string[], size: "", quantity: "1",
  costEGP: "", priceEGP: "", orderNo: "", notes: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [silver, setSilver] = useState<SilverData | null>(null);
  const [silverLoading, setSilverLoading] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const fileRef = useRef<HTMLInputElement>(null);

  // Import sheet state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<number | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shopifySuggestions, setShopifySuggestions] = useState<{ id: string; title: string; priceMin: number; imageUrl?: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setLoadError(null);
    const p = new URLSearchParams();
    if (filterStatus !== "all") p.set("status", filterStatus);
    const s = q !== undefined ? q : search;
    if (s.trim()) p.set("search", s.trim());
    const params = p.toString() ? `?${p}` : "";
    const res = await fetch(`/api/inventory${params}`);
    const data = await res.json();
    if (!res.ok) setLoadError(data.error ?? "Failed to load");
    setItems(data.items ?? []);
    setLoading(false);
  }, [filterStatus]);

  const loadSilver = async () => {
    setSilverLoading(true);
    const res = await fetch("/api/inventory/silver-value");
    const data = await res.json();
    setSilver(data);
    setSilverLoading(false);
  };

  useEffect(() => { load(); loadSilver(); }, [load]);
  // Re-fetch when search changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleColor = (color: string) => {
    setForm((f) => ({
      ...f,
      colors: f.colors.includes(color) ? f.colors.filter((c) => c !== color) : [...f.colors, color],
    }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const uploadRes = await fetch("/api/inventory/upload", { method: "POST", body: fd });
    const uploadData = await uploadRes.json();
    setPhotoUrl(uploadData.url ?? null);
    setUploading(false);

    // AI analysis in parallel
    setAnalyzing(true);
    setAiHints([]);
    try {
      const aiForm = new FormData();
      aiForm.append("file", file);
      const aiRes = await fetch("/api/inventory/analyze-photo", { method: "POST", body: aiForm });
      const ai = await aiRes.json();
      const hints: string[] = [];

      if (ai.name && !form.name) { setForm((f) => ({ ...f, name: ai.name })); hints.push(`Name: ${ai.name}`); }
      if (ai.weightG && !form.weightG) { setForm((f) => ({ ...f, weightG: String(ai.weightG) })); hints.push(`Weight: ${ai.weightG}g`); }
      if (ai.category) { setForm((f) => ({ ...f, category: ai.category })); hints.push(`Category: ${ai.category}`); }
      if (ai.material) setForm((f) => ({ ...f, material: ai.material }));
      if (ai.sku && !form.sku) { setForm((f) => ({ ...f, sku: ai.sku })); hints.push(`SKU: ${ai.sku}`); }
      if (ai.priceEGP && !form.priceEGP) { setForm((f) => ({ ...f, priceEGP: String(ai.priceEGP) })); hints.push(`Price: ${ai.priceEGP} EGP`); }
      if (Array.isArray(ai.colors) && ai.colors.length > 0) {
        setForm((f) => ({ ...f, colors: ai.colors }));
        hints.push(`Colors: ${ai.colors.join(", ")}`);
      }
      setAiHints(hints);
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const lookupShopify = (query: string, field: "name" | "sku") => {
    if (suggTimeoutRef.current) clearTimeout(suggTimeoutRef.current);
    if (query.length < 2) { setShopifySuggestions([]); setShowSuggestions(false); return; }
    suggTimeoutRef.current = setTimeout(async () => {
      const param = field === "sku" ? `sku=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
      const res = await fetch(`/api/shopify/product-price?${param}`);
      const data = await res.json();
      const products = data.products ?? [];
      setShopifySuggestions(products);
      setShowSuggestions(products.length > 0);
    }, 300);
  };

  const applyShopifyMatch = (p: { title: string; priceMin: number }, rename: boolean) => {
    setForm((f) => ({ ...f, priceEGP: String(p.priceMin), ...(rename ? { name: p.title } : {}) }));
    setShopifySuggestions([]); setShowSuggestions(false);
  };

  const bulkSyncPrices = async (rename: boolean) => {
    setSyncing(true); setSyncResult(null);
    const res = await fetch("/api/inventory/sync-prices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rename }),
    });
    const data = await res.json();
    setSyncResult(`Matched ${data.matched}/${data.total} items (${data.skuMatches} by SKU, ${data.nameMatches} by name). ${data.unmatched} unmatched.`);
    setSyncing(false); load(); loadSilver();
    setTimeout(() => setSyncResult(null), 8000);
  };

  const openAdd = () => {
    setEditItem(null); setForm({ ...emptyForm }); setPhotoUrl(null); setAiHints([]);
    setShopifySuggestions([]); setShowSuggestions(false); setShowAdd(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      name: item.name, sku: item.sku ?? "", category: item.category, material: item.material,
      weightG: String(item.weightG), colors: item.colors ?? [], size: item.size ?? "",
      quantity: String(item.quantity),
      costEGP: item.costEGP != null ? String(item.costEGP) : "",
      priceEGP: item.priceEGP != null ? String(item.priceEGP) : "",
      orderNo: item.orderNo ?? "", notes: item.notes ?? "",
    });
    setPhotoUrl(item.photoUrl); setAiHints([]); setShopifySuggestions([]); setShowSuggestions(false); setShowAdd(true);
  };

  const save = async () => {
    if (!form.name || !form.weightG) return;
    setSaving(true);
    const body = { ...form, photoUrl };
    if (editItem) {
      await fetch(`/api/inventory/${editItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    }
    setSaving(false); setShowAdd(false); load(); loadSilver();
  };

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    load(); loadSilver();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    load(); loadSilver();
  };

  // Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file); setImportDone(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("preview", "true");
    const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportPreview(data.rows ?? []); setImportTotal(data.total ?? 0);
  };

  const runImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData(); fd.append("file", importFile);
    const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportDone(data.imported ?? 0); setImporting(false);
    setImportFile(null); setImportPreview(null);
    load(); loadSilver();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Inventory</h1>
        {/* Search bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full border border-zinc-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-zinc-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex border border-zinc-200 rounded-xl overflow-hidden">
            <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}><List size={14} /></button>
          </div>
          <button
            disabled={syncing}
            onClick={() => bulkSyncPrices(false)}
            title="Match all inventory items to Shopify products by SKU or name and fill prices"
            className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm px-3 py-2 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync Prices
          </button>
          <a href="/api/inventory/export" download
            className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm px-3 py-2 rounded-xl hover:bg-zinc-50 transition-colors">
            <Download size={14} /> Export
          </a>
          <button onClick={() => { setShowImport(true); setImportDone(null); setImportPreview(null); setImportFile(null); }}
            className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm px-3 py-2 rounded-xl hover:bg-zinc-50 transition-colors">
            <FileSpreadsheet size={14} /> Import
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors">
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5 border border-emerald-100 mb-3">{syncResult}</div>
      )}

      {/* Silver Dashboard */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-700">925 Silver Stock Value</span>
          </div>
          <button onClick={loadSilver} disabled={silverLoading} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <RefreshCw size={13} className={silverLoading ? "animate-spin" : ""} />
          </button>
        </div>
        {silver ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">Total Weight</p>
              <p className="text-base font-semibold text-zinc-900">{silver.totalWeightG.toLocaleString()}g</p>
              <p className="text-[10px] text-zinc-400">{silver.totalItems} items in stock</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">Pure Silver (92.5%)</p>
              <p className="text-base font-semibold text-zinc-900">{silver.pureSilverG.toLocaleString()}g</p>
              <p className="text-[10px] text-zinc-400">{(silver.pureSilverG / 31.1035).toFixed(2)} troy oz</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">Metal Value (USD)</p>
              {silver.spot ? (
                <>
                  <p className="text-base font-semibold text-zinc-900">${silver.spot.silverValueUSD.toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-400">${silver.spot.pricePerOzUSD}/oz · ${silver.spot.pricePerGramUSD}/g</p>
                </>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">Price unavailable</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">Listing Value (EGP)</p>
              <p className="text-base font-semibold text-zinc-900">{silver.totalListingValueEGP.toLocaleString()} EGP</p>
              <p className="text-[10px] text-zinc-400">at selling prices</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Loader2 size={12} className="animate-spin" /> Loading silver data…
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filterStatus === s ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={18} className="text-zinc-300 animate-spin" /></div>
      ) : loadError ? (
        <div className="text-center py-20 text-red-400 text-sm">{loadError}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 text-sm">No items yet.</div>
      ) : view === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden group">
              <div className="aspect-square bg-zinc-50 relative overflow-hidden">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package size={28} className="text-zinc-200" /></div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => openEdit(item)} className="p-1.5 bg-white rounded-lg"><Edit2 size={13} className="text-zinc-700" /></button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 bg-white rounded-lg"><Trash2 size={13} className="text-red-500" /></button>
                </div>
                {item.orderNo && (
                  <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <ShoppingBag size={8} /> #{item.orderNo}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-zinc-900 truncate">{item.name}</p>
                {item.sku && <p className="text-[10px] text-zinc-400 font-mono">{item.sku}</p>}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Scale size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.weightG}g</span>
                  <span className="text-[10px] text-zinc-300">·</span>
                  <Tag size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.category}</span>
                  {item.colors?.length > 0 && <span className="text-[10px] text-zinc-400">· {item.colors.join(", ")}</span>}
                </div>
                {item.priceEGP && <p className="text-xs font-semibold text-zinc-900 mt-1">{item.priceEGP.toLocaleString()} EGP</p>}
                <div className="mt-2">
                  <select value={item.status} onChange={(e) => changeStatus(item.id, e.target.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[item.status]}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium w-12">Photo</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">SKU</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Name</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Color</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Weight</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Cost</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Price</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Order</th>
                <th className="text-left px-3 py-3 text-zinc-500 font-medium">Status</th>
                <th className="px-3 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className={`border-t border-zinc-50 hover:bg-zinc-50/50 ${i % 2 === 0 ? "" : "bg-zinc-50/30"}`}>
                  <td className="px-4 py-2">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                        <Package size={14} className="text-zinc-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{item.sku ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900 max-w-[160px]">
                    <p className="truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-400 font-normal">{item.category}</p>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{item.colors?.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{item.weightG}g</td>
                  <td className="px-3 py-2 text-zinc-500">{item.costEGP ? `${item.costEGP.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{item.priceEGP ? `${item.priceEGP.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {item.orderNo ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <ShoppingBag size={10} />#{item.orderNo}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.status} onChange={(e) => changeStatus(item.id, e.target.value)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[item.status]}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} className="p-1 text-zinc-400 hover:text-zinc-700"><Edit2 size={13} /></button>
                      <button onClick={() => deleteItem(item.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold">Import Inventory Sheet</h2>
              <button onClick={() => setShowImport(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {importDone !== null ? (
                <div className="text-center py-6">
                  <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-medium">{importDone} items imported</p>
                  <button onClick={() => setShowImport(false)} className="mt-4 text-xs text-zinc-400 underline">Close</button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-zinc-500 bg-zinc-50 rounded-xl p-3 space-y-1">
                    <p className="font-medium text-zinc-700">Columns accepted:</p>
                    <p>name, sku, category, material, weight (g), colors, quantity, cost (EGP), price (EGP), order no, notes</p>
                    <p className="text-zinc-400">Supports .xlsx, .xls, .csv — Arabic headers OK</p>
                  </div>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
                  <button onClick={() => importFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-6 flex flex-col items-center gap-2 text-zinc-400 hover:border-zinc-400 transition-colors">
                    <Upload size={20} />
                    <span className="text-xs">{importFile ? importFile.name : "Choose file"}</span>
                  </button>
                  {importPreview && importPreview.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Preview — {importTotal} rows:</p>
                      <div className="overflow-x-auto rounded-xl border border-zinc-100">
                        <table className="text-xs w-full">
                          <thead className="bg-zinc-50">
                            <tr>{["Name", "SKU", "Weight", "Qty", "Price"].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-zinc-500 font-medium">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {importPreview.map((r, i) => (
                              <tr key={i} className="border-t border-zinc-50">
                                <td className="px-3 py-2 text-zinc-900 max-w-[100px] truncate">{String(r.name ?? "")}</td>
                                <td className="px-3 py-2 text-zinc-400 font-mono">{String(r.sku ?? "—")}</td>
                                <td className="px-3 py-2 text-zinc-500">{r.weightG != null ? `${r.weightG}g` : "—"}</td>
                                <td className="px-3 py-2 text-zinc-500">{String(r.quantity ?? "")}</td>
                                <td className="px-3 py-2 text-zinc-500">{r.priceEGP ? `${r.priceEGP} EGP` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {importTotal > 10 && <p className="text-[10px] text-zinc-400 mt-1">…and {importTotal - 10} more</p>}
                      <button onClick={runImport} disabled={importing}
                        className="mt-3 w-full bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 flex items-center justify-center gap-2">
                        {importing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {importing ? "Importing…" : `Import all ${importTotal} items`}
                      </button>
                    </div>
                  )}
                  {importPreview?.length === 0 && (
                    <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl p-3">
                      <AlertCircle size={14} /> No valid rows. Make sure file has name and weight columns.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold">{editItem ? "Edit Item" : "Add Item"}</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Photo */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-2">
                  Photo {!editItem && <span className="text-zinc-400 font-normal">— AI reads name, SKU, weight, color & price</span>}
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                {photoUrl ? (
                  <div className="relative">
                    <img src={photoUrl} alt="Item" className="w-full h-44 object-cover rounded-xl" />
                    <button onClick={() => { setPhotoUrl(null); setAiHints([]); }} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X size={12} /></button>
                    {analyzing && (
                      <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center gap-2">
                        <Sparkles size={16} className="text-white animate-pulse" />
                        <span className="text-white text-xs font-medium">Analyzing…</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full h-32 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-zinc-400 transition-colors">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : (<><Camera size={20} /><span className="text-xs">Take photo — AI reads details</span></>)}
                  </button>
                )}
                {aiHints.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                    <Sparkles size={12} className="mt-0.5 shrink-0" />
                    <span>AI detected: {aiHints.join(" · ")}</span>
                  </div>
                )}
              </div>

              {/* Name + SKU */}
              <div className="space-y-3">
                {/* Name with Shopify picker */}
                <div className="relative">
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Item Name *</label>
                  <input type="text" value={form.name}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); lookupShopify(e.target.value, "name"); }}
                    placeholder="Type name to search Shopify products…"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                  {showSuggestions && shopifySuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                      {shopifySuggestions.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 border-b border-zinc-50 last:border-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.title} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-900 truncate">{p.title}</p>
                            <p className="text-[10px] text-emerald-600">{p.priceMin.toLocaleString()} EGP</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button type="button" onMouseDown={() => applyShopifyMatch(p, false)}
                              className="text-[10px] px-2 py-1 bg-zinc-100 rounded-lg text-zinc-600 hover:bg-zinc-200">
                              Price only
                            </button>
                            <button type="button" onMouseDown={() => applyShopifyMatch(p, true)}
                              className="text-[10px] px-2 py-1 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700">
                              Apply + rename
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* SKU */}
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">
                    <Hash size={10} className="inline mr-0.5" />SKU / Code
                  </label>
                  <input type="text" value={form.sku}
                    onChange={(e) => { setForm({ ...form, sku: e.target.value }); lookupShopify(e.target.value, "sku"); }}
                    placeholder="e.g. R00012-7 — searches Shopify by SKU"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 font-mono" />
                </div>
              </div>

              {/* Category + Material */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Category *</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Material</label>
                  <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400">
                    {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-2">Colors</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS_LIST.map((color) => (
                    <button key={color} type="button" onClick={() => toggleColor(color)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.colors.includes(color)
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                      }`}>
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight + Qty */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Weight (g) *</label>
                  <input type="number" step="0.1" min="0" value={form.weightG}
                    onChange={(e) => setForm({ ...form, weightG: e.target.value })} placeholder="e.g. 4.5"
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Size</label>
                  <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="e.g. 7, M, 16mm"
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Quantity</label>
                  <input type="number" min="1" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
              </div>

              {/* Cost + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Cost (EGP)</label>
                  <input type="number" min="0" value={form.costEGP}
                    onChange={(e) => setForm({ ...form, costEGP: e.target.value })} placeholder="Cost"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Price (EGP)</label>
                  <input type="number" min="0" value={form.priceEGP}
                    onChange={(e) => setForm({ ...form, priceEGP: e.target.value })} placeholder="Selling price"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
              </div>

              {/* Order No */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">
                  <ShoppingBag size={10} className="inline mr-0.5" />Order No
                  <span className="text-zinc-400 font-normal ml-1">— auto-marks sold when order is fulfilled & paid</span>
                </label>
                <input type="text" value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
                  placeholder="e.g. 1042"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Extra details…" rows={2}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-zinc-400" />
              </div>

              <button onClick={save} disabled={saving || !form.name || !form.weightG}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {saving ? "Saving…" : editItem ? "Save Changes" : "Add to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
