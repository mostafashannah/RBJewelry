"use client";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Download } from "lucide-react";

interface Expense {
  id: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
}

const CATEGORIES = ["Ad Spend", "Shipping", "Materials", "Operations", "Marketing", "Other"];

export default function FinancesPage() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[0], amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") });
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const url = month === "all" ? `/api/finances/expenses` : `/api/finances/expenses?month=${month}`;
    const res = await fetch(url);
    const data = await res.json();
    setExpenses(data.expenses ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => { loadExpenses(); }, [month, loadExpenses]);

  const addExpense = async () => {
    if (!form.amount) return;
    await fetch("/api/finances/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        date: new Date(form.date).toISOString(),
      }),
    });
    setShowAdd(false);
    setForm({ category: CATEGORIES[0], amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") });
    loadExpenses();
  };

  const exportToSheets = async () => {
    setExporting(true);
    const res = await fetch("/api/finances/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const data = await res.json();
    if (data.ok) {
      setExportMsg(`Exported: Revenue ${data.revenue?.toLocaleString()} EGP | Expenses ${data.totalExpenses?.toLocaleString()} EGP | Profit ${data.profit?.toLocaleString()} EGP`);
    }
    setExporting(false);
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Finances</h1>
          <p className="text-sm text-zinc-500 mt-1">Track expenses and export to Google Sheets</p>
        </div>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none bg-white"
          >
            <option value="all">All time</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <Plus size={13} /> Add Expense
          </button>
          <button
            onClick={exportToSheets}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600 transition-colors disabled:opacity-40"
          >
            <Download size={13} /> Export to Sheets
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="mb-4 text-xs text-green-700 bg-green-50 rounded-lg px-4 py-2">{exportMsg}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-zinc-100 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Total Expenses</p>
          <p className="text-xl font-semibold text-zinc-900 mt-1">{totalExpenses.toLocaleString()} EGP</p>
        </div>
        <div className="bg-white border border-zinc-100 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Expense Entries</p>
          <p className="text-xl font-semibold text-zinc-900 mt-1">{expenses.length}</p>
        </div>
        <div className="bg-white border border-zinc-100 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Period</p>
          <p className="text-xl font-semibold text-zinc-900 mt-1">{month === "all" ? "All time" : month}</p>
        </div>
      </div>

      {/* Add expense modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-4">Add Expense</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount (EGP)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="Optional note"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="flex-1 border border-zinc-200 rounded-lg py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
                <button onClick={addExpense} className="flex-1 bg-zinc-900 text-white rounded-lg py-2 text-sm hover:bg-zinc-700">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense table */}
      {loading ? (
        <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-10">No expenses for {month === "all" ? "this period" : month}.</p>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Category", "Amount", "Description", "Date"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-700">{e.category}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{e.amount.toLocaleString()} {e.currency}</td>
                  <td className="px-4 py-3 text-zinc-500">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{format(new Date(e.date), "MMM d, yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
