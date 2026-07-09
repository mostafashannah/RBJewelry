"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Package, Tag, ShoppingBag, Hash,
  Calendar, Pencil, X, Plus, Loader2, AlertCircle,
} from "lucide-react";

interface Item {
  id: string; name: string; sku: string | null; category: string; material: string;
  weightG: number; colors: string[]; size: string | null; quantity: number;
  costEGP: number | null;
  metalCostEGP: number | null; platingCostEGP: number | null; stoneCostEGP: number | null;
  manufacturingCostEGP: number | null; transportationCostEGP: number | null;
  priceEGP: number | null; photoUrl: string | null; status: string;
  orderNo: string | null; notes: string | null; createdAt: string; updatedAt: string;
}

interface LogEntry { ts: string; text: string; }

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "In Stock", SOLD: "Sold", RESERVED: "Reserved", DAMAGED: "Damaged",
};
const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SOLD: "bg-zinc-100 text-zinc-500 border-zinc-200",
  RESERVED: "bg-amber-50 text-amber-700 border-amber-200",
  DAMAGED: "bg-red-50 text-red-600 border-red-200",
};

function parseLogs(notes: string | null): LogEntry[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* plain text — treat as single legacy entry */ }
  return notes.trim() ? [{ ts: "", text: notes }] : [];
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-EG") + " EGP";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newLog, setNewLog] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    fetch(`/api/inventory/${id}`)
      .then(r => r.json())
      .then(data => {
        setItem(data);
        setLogs(parseLogs(data.notes));
      })
      .catch(() => setError("Failed to load item"))
      .finally(() => setLoading(false));
  }, [id]);

  async function addLog() {
    if (!newLog.trim() || !item) return;
    setSavingLog(true);
    const entry: LogEntry = { ts: new Date().toISOString(), text: newLog.trim() };
    const updated = [...logs, entry];
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: JSON.stringify(updated) }),
    });
    setLogs(updated);
    setNewLog("");
    setSavingLog(false);
  }

  async function changeStatus(status: string) {
    if (!item) return;
    setSavingStatus(true);
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setItem({ ...item, status });
    setEditStatus(false);
    setSavingStatus(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  if (error || !item) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
      <AlertCircle className="w-8 h-8" />
      <p>{error ?? "Item not found"}</p>
      <button onClick={() => router.back()} className="text-sm text-zinc-500 underline">Go back</button>
    </div>
  );

  const profit = item.priceEGP != null && item.costEGP != null
    ? item.priceEGP - item.costEGP : null;
  const margin = profit != null && item.priceEGP
    ? ((profit / item.priceEGP) * 100).toFixed(1) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 truncate">{item.name}</h1>
          {item.sku && <p className="text-sm text-zinc-400">{item.sku}</p>}
        </div>
        {/* Status badge / picker */}
        {editStatus ? (
          <div className="flex items-center gap-2">
            {["IN_STOCK","SOLD","RESERVED","DAMAGED"].map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={savingStatus}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-opacity ${STATUS_COLORS[s]} ${savingStatus ? "opacity-50" : "hover:opacity-80"}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            <button onClick={() => setEditStatus(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditStatus(true)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[item.status]} flex items-center gap-1`}
          >
            {STATUS_LABELS[item.status] ?? item.status}
            <Pencil className="w-3 h-3 opacity-60" />
          </button>
        )}
      </div>

      {/* Photo + core info */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="flex gap-4 p-5">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt={item.name} className="w-28 h-28 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-8 h-8 text-zinc-300" />
            </div>
          )}
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Category</p>
              <p className="font-medium text-zinc-700">{item.category}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Material</p>
              <p className="font-medium text-zinc-700">{item.material}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Weight</p>
              <p className="font-medium text-zinc-700">{item.weightG > 0 ? `${item.weightG}g` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Size</p>
              <p className="font-medium text-zinc-700">{item.size ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Colors</p>
              <p className="font-medium text-zinc-700">{item.colors.length > 0 ? item.colors.join(", ") : "Main"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Quantity</p>
              <p className="font-medium text-zinc-700">{item.quantity}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          <Tag className="w-4 h-4 text-zinc-400" /> Financials
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-xs text-zinc-400 mb-1">Selling Price</p>
            <p className="text-base font-semibold text-zinc-900">{fmt(item.priceEGP)}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-xs text-zinc-400 mb-1">Total Cost</p>
            <p className="text-base font-semibold text-zinc-900">{fmt(item.costEGP)}</p>
          </div>
          {profit != null && (
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-emerald-600 mb-1">Profit</p>
              <p className="text-base font-semibold text-emerald-700">{fmt(profit)}</p>
            </div>
          )}
          {margin != null && (
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-emerald-600 mb-1">Margin</p>
              <p className="text-base font-semibold text-emerald-700">{margin}%</p>
            </div>
          )}
        </div>
        {/* Cost breakdown */}
        {(item.metalCostEGP || item.platingCostEGP || item.stoneCostEGP ||
          item.manufacturingCostEGP || item.transportationCostEGP) && (
          <div className="border-t border-zinc-100 pt-4 space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Cost breakdown</p>
            {[
              ["Metal", item.metalCostEGP],
              ["Plating", item.platingCostEGP],
              ["Stone", item.stoneCostEGP],
              ["Manufacturing", item.manufacturingCostEGP],
              ["Transportation", item.transportationCostEGP],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-zinc-500">{label as string}</span>
                <span className="font-medium text-zinc-700">{fmt(val as number)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order info */}
      {item.orderNo && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-zinc-400" /> Order
          </h2>
          <p className="text-sm text-amber-600 font-medium">#{item.orderNo}</p>
        </div>
      )}

      {/* Dates */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-zinc-400" /> Dates
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Created</p>
            <p className="text-zinc-700">{fmtDate(item.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Last updated</p>
            <p className="text-zinc-700">{fmtDate(item.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Log / Notes */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          <Hash className="w-4 h-4 text-zinc-400" /> Log
        </h2>

        {logs.length === 0 && (
          <p className="text-sm text-zinc-400 italic">No log entries yet.</p>
        )}

        <div className="space-y-3">
          {logs.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-1 w-2 h-2 rounded-full bg-zinc-300 flex-shrink-0" />
              <div>
                {entry.ts && (
                  <p className="text-xs text-zinc-400 mb-0.5">{fmtDate(entry.ts)}</p>
                )}
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{entry.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add log entry */}
        <div className="flex gap-2 pt-1">
          <input
            value={newLog}
            onChange={e => setNewLog(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addLog(); } }}
            placeholder="Add a note or log entry…"
            className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
          <button
            onClick={addLog}
            disabled={!newLog.trim() || savingLog}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 transition-colors flex items-center gap-1"
          >
            {savingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

    </div>
  );
}
