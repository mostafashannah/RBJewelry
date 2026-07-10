"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Loader2, CheckCircle, AlertCircle, Upload } from "lucide-react";

const CATEGORIES = ["Ring", "Necklace", "Bracelet", "Earrings", "Anklet", "Set", "Other"];
const COLORS_LIST = ["Silver", "Gold", "Rose Gold", "Black", "White", "Blue", "Red", "Green", "Pink", "Purple", "Mixed"];
const CAT_PREFIX: Record<string, string> = {
  Ring: "R", Earrings: "E", Necklace: "N", Bracelet: "B", Set: "S", Anklet: "A", Other: "O",
};

type Row = {
  id: string;
  name: string;
  sku: string;
  category: string;
  size: string;
  weightG: string;
  colors: string;
  quantity: string;
};

const emptyRow = (id: string): Row => ({
  id, name: "", sku: "", category: "Ring", size: "", weightG: "", colors: "", quantity: "1",
});

function newId() { return Math.random().toString(36).slice(2, 9); }

function initRows(n = 10): Row[] {
  return Array.from({ length: n }, () => emptyRow(newId()));
}

type RowStatus = { ok: boolean; message: string } | null;

export default function BulkAddPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initRows);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  function updateRow(id: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() {
    const id = newId();
    setRows((rs) => [...rs, emptyRow(id)]);
    setTimeout(() => {
      tableRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setStatuses((s) => { const ns = { ...s }; delete ns[id]; return ns; });
  }

  function isRowEmpty(r: Row) {
    return !r.name.trim() && !r.sku.trim() && !r.weightG.trim();
  }

  function autoSku(row: Row, index: number): string {
    if (row.sku.trim()) return row.sku.trim();
    const prefix = CAT_PREFIX[row.category] ?? "O";
    return `${prefix}${String(index + 1).padStart(5, "0")}`;
  }

  async function handleSubmit() {
    const active = rows.filter((r) => !isRowEmpty(r));
    if (!active.length) return;
    setSubmitting(true);
    setDone(false);
    const newStatuses: Record<string, RowStatus> = {};

    await Promise.all(
      active.map(async (row, i) => {
        if (!row.name.trim()) {
          newStatuses[row.id] = { ok: false, message: "Name is required" };
          return;
        }
        if (!row.weightG || parseFloat(row.weightG) <= 0) {
          newStatuses[row.id] = { ok: false, message: "Weight is required" };
          return;
        }
        const colorsArr = row.colors
          ? row.colors.split(",").map((c) => c.trim()).filter(Boolean)
          : [];
        try {
          const res = await fetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: row.name.trim(),
              sku: autoSku(row, i) || null,
              category: row.category,
              size: row.size.trim() || null,
              weightG: row.weightG,
              colors: colorsArr,
              quantity: row.quantity || "1",
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            newStatuses[row.id] = { ok: false, message: err.error ?? "Failed" };
          } else {
            newStatuses[row.id] = { ok: true, message: "Added" };
          }
        } catch {
          newStatuses[row.id] = { ok: false, message: "Network error" };
        }
      })
    );

    setStatuses(newStatuses);
    setSubmitting(false);
    setDone(true);
  }

  function clearDone() {
    const successIds = new Set(
      Object.entries(statuses).filter(([, s]) => s?.ok).map(([id]) => id)
    );
    setRows((rs) => rs.filter((r) => !successIds.has(r.id)));
    setStatuses((s) => {
      const ns = { ...s };
      successIds.forEach((id) => delete ns[id]);
      return ns;
    });
    setDone(false);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTableElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const pasteRows = text.trim().split("\n").map((line) =>
      line.split("\t").map((c) => c.trim())
    );
    const newRows: Row[] = pasteRows.map((cols) => ({
      id: newId(),
      name: cols[0] ?? "",
      sku: cols[1] ?? "",
      category: CATEGORIES.includes(cols[2] ?? "") ? (cols[2] ?? "Ring") : "Ring",
      size: cols[3] ?? "",
      weightG: cols[4] ?? "",
      colors: cols[5] ?? "",
      quantity: cols[6] ?? "1",
    }));
    setRows((rs) => {
      const empties = rs.filter(isRowEmpty);
      const filled = rs.filter((r) => !isRowEmpty(r));
      const merged = [...filled, ...newRows];
      // Keep at least a few empty rows at the bottom
      const extra = empties.length > newRows.length ? empties.slice(newRows.length) : [emptyRow(newId()), emptyRow(newId())];
      return [...merged, ...extra];
    });
  }

  const activeCount = rows.filter((r) => !isRowEmpty(r)).length;
  const successCount = Object.values(statuses).filter((s) => s?.ok).length;
  const errorCount = Object.values(statuses).filter((s) => s && !s.ok).length;

  const COLS = [
    { key: "name", label: "Name *", width: "w-48", placeholder: "Item name" },
    { key: "sku", label: "SKU", width: "w-28", placeholder: "Auto" },
    { key: "category", label: "Category", width: "w-28", type: "select" },
    { key: "size", label: "Size", width: "w-16", placeholder: "e.g. 7" },
    { key: "weightG", label: "Weight (g) *", width: "w-24", placeholder: "e.g. 4.5", type: "number" },
    { key: "colors", label: "Colors", width: "w-32", placeholder: "Gold, Silver…" },
    { key: "quantity", label: "Qty", width: "w-16", placeholder: "1", type: "number" },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/inventory")}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" />
              Inventory
            </button>
            <span className="text-zinc-300">/</span>
            <h1 className="text-lg font-semibold text-zinc-900">Bulk Add Items</h1>
          </div>
          <div className="flex items-center gap-2">
            {done && successCount > 0 && (
              <button onClick={clearDone}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors border border-zinc-200 rounded-xl px-3 py-2">
                Clear {successCount} added
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || activeCount === 0}
              className="flex items-center gap-2 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {submitting ? "Adding…" : `Add ${activeCount || ""} Item${activeCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {/* Result banner */}
        {done && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${errorCount === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {errorCount === 0
              ? <><CheckCircle className="w-4 h-4 shrink-0" /> {successCount} item{successCount !== 1 ? "s" : ""} added successfully.</>
              : <><AlertCircle className="w-4 h-4 shrink-0" /> {successCount} added, {errorCount} failed — see red rows below.</>
            }
          </div>
        )}

        {/* Tip */}
        <p className="text-xs text-zinc-400 mb-3">
          Tip: Copy rows from Excel/Sheets and paste directly into the table (columns: Name, SKU, Category, Size, Weight, Colors, Qty).
        </p>

        {/* Table */}
        <div ref={tableRef} className="bg-white rounded-2xl border border-zinc-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm" onPaste={handlePaste}>
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="w-8 px-2 py-3 text-center text-xs font-medium text-zinc-400">#</th>
                {COLS.map((c) => (
                  <th key={c.key} className={`${c.width} px-2 py-3 text-left text-xs font-medium text-zinc-500`}>{c.label}</th>
                ))}
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const st = statuses[row.id];
                const rowCls = st
                  ? st.ok
                    ? "bg-emerald-50"
                    : "bg-red-50"
                  : isRowEmpty(row)
                    ? ""
                    : "bg-zinc-50/50";
                return (
                  <tr key={row.id} data-id={row.id} className={`border-b border-zinc-100 last:border-0 ${rowCls}`}>
                    <td className="px-2 py-1.5 text-center text-xs text-zinc-400">{i + 1}</td>
                    {COLS.map((col) => (
                      <td key={col.key} className="px-1 py-1">
                        {col.key === "category" ? (
                          <select
                            value={row.category}
                            onChange={(e) => updateRow(row.id, "category", e.target.value)}
                            className="w-full border border-transparent rounded-lg px-2 py-1.5 text-sm bg-transparent hover:border-zinc-200 focus:border-zinc-400 focus:outline-none transition-colors">
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        ) : col.key === "colors" ? (
                          <input
                            value={row.colors}
                            onChange={(e) => updateRow(row.id, "colors", e.target.value)}
                            list={`colors-${row.id}`}
                            placeholder={col.placeholder}
                            className="w-full border border-transparent rounded-lg px-2 py-1.5 text-sm bg-transparent hover:border-zinc-200 focus:border-zinc-400 focus:outline-none transition-colors placeholder:text-zinc-300"
                          />
                        ) : (
                          <input
                            type={col.type === "number" ? "number" : "text"}
                            step={col.key === "weightG" ? "0.1" : undefined}
                            min={col.type === "number" ? "0" : undefined}
                            value={row[col.key as keyof Row]}
                            onChange={(e) => updateRow(row.id, col.key as keyof Row, e.target.value)}
                            placeholder={col.placeholder}
                            className="w-full border border-transparent rounded-lg px-2 py-1.5 text-sm bg-transparent hover:border-zinc-200 focus:border-zinc-400 focus:outline-none transition-colors placeholder:text-zinc-300"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-1 py-1 text-center">
                      {st ? (
                        st.ok
                          ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <span title={st.message}><AlertCircle className="w-4 h-4 text-red-400 mx-auto" /></span>
                      ) : (
                        <button onClick={() => removeRow(row.id)}
                          className="text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <button onClick={addRow}
          className="mt-3 flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 text-sm transition-colors">
          <Plus className="w-4 h-4" />
          Add row
        </button>

        {/* Color hint */}
        <div className="mt-4 text-xs text-zinc-400">
          <span className="font-medium">Colors:</span>{" "}
          {COLORS_LIST.join(", ")}
        </div>
      </div>
    </div>
  );
}
