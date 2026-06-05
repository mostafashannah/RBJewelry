"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Camera, X, Scale, Tag, Package, Loader2, CheckCircle, Trash2, Edit2 } from "lucide-react";

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
  id: string;
  name: string;
  category: string;
  material: string;
  weightG: number;
  quantity: number;
  costEGP: number | null;
  priceEGP: number | null;
  photoUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const empty = {
  name: "",
  category: CATEGORIES[0],
  material: MATERIALS[0],
  weightG: "",
  quantity: "1",
  costEGP: "",
  priceEGP: "",
  notes: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/inventory/upload", { method: "POST", body: fd });
    const data = await res.json();
    setPhotoUrl(data.url ?? null);
    setUploading(false);
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...empty });
    setPhotoUrl(null);
    setShowAdd(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      material: item.material,
      weightG: String(item.weightG),
      quantity: String(item.quantity),
      costEGP: item.costEGP != null ? String(item.costEGP) : "",
      priceEGP: item.priceEGP != null ? String(item.priceEGP) : "",
      notes: item.notes ?? "",
    });
    setPhotoUrl(item.photoUrl);
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.name || !form.weightG) return;
    setSaving(true);
    const body = { ...form, photoUrl };
    if (editItem) {
      await fetch(`/api/inventory/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    setShowAdd(false);
    load();
  };

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
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
            {inStock} items in stock · {totalValue > 0 ? `${totalValue.toLocaleString()} EGP value` : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors"
        >
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              filterStatus === s ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={18} className="text-zinc-300 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 text-sm">No items yet. Add your first piece.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden group">
              {/* Photo */}
              <div className="aspect-square bg-zinc-50 relative overflow-hidden">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={28} className="text-zinc-200" />
                  </div>
                )}
                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 bg-white rounded-lg"
                  >
                    <Edit2 size={13} className="text-zinc-700" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 bg-white rounded-lg"
                  >
                    <Trash2 size={13} className="text-red-500" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-medium text-zinc-900 truncate">{item.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Scale size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.weightG}g</span>
                  <span className="text-[10px] text-zinc-300 mx-0.5">·</span>
                  <Tag size={10} className="text-zinc-300" />
                  <span className="text-[10px] text-zinc-400">{item.category}</span>
                </div>
                {item.priceEGP && (
                  <p className="text-xs font-semibold text-zinc-900 mt-1">{item.priceEGP.toLocaleString()} EGP</p>
                )}
                <div className="mt-2">
                  <select
                    value={item.status}
                    onChange={(e) => changeStatus(item.id, e.target.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[item.status]}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">{editItem ? "Edit Item" : "Add Item"}</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} className="text-zinc-400" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Photo */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-2">Photo</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                />
                {photoUrl ? (
                  <div className="relative">
                    <img src={photoUrl} alt="Item" className="w-full h-40 object-cover rounded-xl" />
                    <button
                      onClick={() => setPhotoUrl(null)}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-32 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-zinc-400 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <Camera size={20} />
                        <span className="text-xs">Take photo or upload</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Silver Ring with Zircon"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                />
              </div>

              {/* Category + Material */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Material</label>
                  <select
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  >
                    {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Weight + Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Weight (grams) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.weightG}
                    onChange={(e) => setForm({ ...form, weightG: e.target.value })}
                    placeholder="e.g. 4.5"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              {/* Cost + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Cost (EGP)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.costEGP}
                    onChange={(e) => setForm({ ...form, costEGP: e.target.value })}
                    placeholder="Cost price"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 block mb-1">Price (EGP)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.priceEGP}
                    onChange={(e) => setForm({ ...form, priceEGP: e.target.value })}
                    placeholder="Selling price"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-zinc-600 block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any extra details…"
                  rows={2}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-zinc-400"
                />
              </div>

              <button
                onClick={save}
                disabled={saving || !form.name || !form.weightG}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
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
