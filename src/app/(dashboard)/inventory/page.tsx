"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Camera, X, Scale, Tag, Package, Loader2, CheckCircle,
  Trash2, Edit2, Upload, FileSpreadsheet, Sparkles, AlertCircle,
} from "lucide-react";

const CATEGORIES = ["Ring", "Necklace", "Bracelet", "Earrings", "Anklet", "Set", "Other"];
const MATERIALS = ["Sterling Silver", "Gold-Plated Silver", "Rose Gold-Plated", "18K Gold", "Other"];
const STATUSES = ["IN_STOCK", "SOLD", "RESERVED", "DAMAGED"] as const;
const STATUS_LABELS: Record<string, string> = { IN_STOCK: "In Stock", SOLD: "Sold", RESERVED: "Reserved", DAMAGED: "Damaged" };
const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-700",
  SOLD: "bg-zinc-100 text-zinc-500",
  RESERVED: "bg-amber-50 text-amber-700",
  DAMAGED: "bg-red-50 text-red-600",
};

interface Item {
  id: string; name: string; category: string; material: string;
  weightG: number; quantity: number; costEGP: number | null;
  priceEGP: number | null; photoUrl: string | null; status: string;
  notes: string | null; createdAt: string;
}

const empty = {
  name: "", category: CATEGORIES[0], material: MATERIALS[0],
  weightG: "", quantity: "1", costEGP: "", priceEGP: "", notes: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import sheet state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<number | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    const res = await fetch(`/api/inventory${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload photo
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const uploadRes = await fetch("/api/inventory/upload", { method: "POST", body: fd });
    const uploadData = await uploadRes.json();
    setPhotoUrl(uploadData.url ?? null);
    setUploading(false);

    // Simultaneously analyze with AI
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
      if (ai.material) { setForm((f) => ({ ...f, material: ai.material })); }
      if (ai.sku) {
        setForm((f) => ({ ...f, notes: f.notes ? f.notes : `SKU: ${ai.sku}` }));
        hints.push(`SKU: ${ai.sku}`);
      }
      setAiHints(hints);
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const openAdd = () => {
    setEditItem(null); setForm({ ...empty }); setPhotoUrl(null); setAiHints([]); setShowAdd(true);
  };
  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      name: item.name, category: item.category, material: item.material,
      weightG: String(item.weightG), quantity: String(item.quantity),
      costEGP: item.costEGP != null ? String(item.costEGP) : "",
      priceEGP: item.priceEGP != null ? String(item.priceEGP) : "",
      notes: item.notes ?? "",
    });
    setPhotoUrl(item.photoUrl); setAiHints([]); setShowAdd(true);
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
    setSaving(false); setShowAdd(false); load();
  };

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    load();
  };

  // Import sheet
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportDone(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("preview", "true");
    const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportPreview(data.rows ?? []);
    setImportTotal(data.total ?? 0);
  };

  const runImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch("/api/inventory/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportDone(data.imported ?? 0);
    setImporting(false);
    setImportFile(null);
    setImportPreview(null);
    load();
  };

  const inStock = items.filter((i) => i.status === "IN_STOCK").length;
  const totalValue = items
    .filter((i) => i.status === "IN_STOCK" && i.priceEGP)
    .reduce((s, i) => s + (i.priceEGP ?? 0) * i.quantity, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Inventory</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {inStock} in stock{totalValue > 0 ? ` · ${totalValue.toLocaleString()} EGP` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setImportDone(null); setImportPreview(null); setImportFile(null); }}
            className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm px-3 py-2 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            <FileSpreadsheet size={14} /> Import Sheet
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
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

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={18} className="text-zinc-300 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 text-sm">No items yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden group">
              <div className="aspect-square bg-zinc-50 relative overflow-hidden">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={28} className="text-zinc-200" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => openEdit(item)} className="p-1.5 bg-white rounded-lg">
                    <Edit2 size={13} className="text-zinc-700" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 bg-white rounded-lg">
                    <Trash2 size={13} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-zinc-900 truncate">{item.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Scale size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.weightG}g</span>
                  <span className="text-[10px] text-zinc-300 mx-0.5">·</span>
                  <Tag size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.category}</span>
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
      )}

      {/* ── Import Sheet Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Import Inventory Sheet</h2>
              <button onClick={() => setShowImport(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {importDone !== null ? (
                <div className="text-center py-6">
                  <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-zinc-900">{importDone} items imported successfully</p>
                  <button onClick={() => setShowImport(false)} className="mt-4 text-xs text-zinc-400 underline">Close</button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-zinc-500 bg-zinc-50 rounded-xl p-3 space-y-1">
                    <p className="font-medium text-zinc-700">Expected columns (any order):</p>
                    <p>name, category, material, weight (g), quantity, cost (EGP), price (EGP), SKU, notes</p>
                    <p className="text-zinc-400">Supports .xlsx, .xls, .csv — Arabic headers also accepted</p>
                  </div>

                  <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-6 flex flex-col items-center gap-2 text-zinc-400 hover:border-zinc-400 transition-colors"
                  >
                    <Upload size={20} />
                    <span className="text-xs">{importFile ? importFile.name : "Choose file"}</span>
                  </button>

                  {importPreview && importPreview.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Preview — {importTotal} rows detected:</p>
                      <div className="overflow-x-auto rounded-xl border border-zinc-100">
                        <table className="text-xs w-full">
                          <thead className="bg-zinc-50">
                            <tr>
                              {["Name", "Category", "Weight", "Qty", "Price"].map((h) => (
                                <th key={h} className="text-left px-3 py-2 text-zinc-500 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.map((r: Record<string, unknown>, i) => (
                              <tr key={i} className="border-t border-zinc-50">
                                <td className="px-3 py-2 text-zinc-900 max-w-[120px] truncate">{String(r.name ?? "")}</td>
                                <td className="px-3 py-2 text-zinc-500">{String(r.category ?? "")}</td>
                                <td className="px-3 py-2 text-zinc-500">{r.weightG != null ? `${r.weightG}g` : "—"}</td>
                                <td className="px-3 py-2 text-zinc-500">{String(r.quantity ?? "")}</td>
                                <td className="px-3 py-2 text-zinc-500">{r.priceEGP ? `${r.priceEGP} EGP` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {importTotal > 10 && (
                        <p className="text-[10px] text-zinc-400 mt-1">…and {importTotal - 10} more rows</p>
                      )}
                      <button
                        onClick={runImport}
                        disabled={importing}
                        className="mt-3 w-full bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                      >
                        {importing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {importing ? "Importing…" : `Import all ${importTotal} items`}
                      </button>
                    </div>
                  )}

                  {importPreview && importPreview.length === 0 && (
                    <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl p-3">
                      <AlertCircle size={14} />
                      No valid rows found. Make sure the file has name and weight columns.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">{editItem ? "Edit Item" : "Add Item"}</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Photo + AI scan */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-2">
                  Photo
                  {!editItem && <span className="text-zinc-400 font-normal ml-1">— AI will read name, SKU & weight automatically</span>}
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                {photoUrl ? (
                  <div className="relative">
                    <img src={photoUrl} alt="Item" className="w-full h-44 object-cover rounded-xl" />
                    <button onClick={() => { setPhotoUrl(null); setAiHints([]); }} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                      <X size={12} />
                    </button>
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
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : (
                      <>
                        <Camera size={20} />
                        <span className="text-xs">Take photo — AI reads details</span>
                      </>
                    )}
                  </button>
                )}

                {/* AI hints */}
                {aiHints.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                    <Sparkles size={12} className="mt-0.5 shrink-0" />
                    <span>AI detected: {aiHints.join(" · ")}</span>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">Item Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Silver Ring with Zircon"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
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

              {/* Weight + Qty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Weight (g) *</label>
                  <input type="number" step="0.1" min="0" value={form.weightG}
                    onChange={(e) => setForm({ ...form, weightG: e.target.value })} placeholder="e.g. 4.5"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Quantity</label>
                  <input type="number" min="1" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
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

              {/* Notes / SKU */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">Notes / SKU</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="SKU, extra details…" rows={2}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-zinc-400" />
              </div>

              <button onClick={save} disabled={saving || !form.name || !form.weightG}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
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
