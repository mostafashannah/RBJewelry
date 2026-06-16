"use client";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Download, TrendingUp, TrendingDown, Package, ShoppingBag, Users, Trash2, Pencil } from "lucide-react";

interface Expense {
  id: string; category: string; amount: number; currency: string;
  description: string | null; date: string;
}

interface Investment {
  id: string; name: string; amount: number; currency: string;
  date: string; notes: string | null;
}

interface Summary {
  revenue: number; totalExpenses: number; profit: number;
  stockValue: number; stockItemCount: number; paidOrderCount: number;
  byCategory: Record<string, number>; totalInvested: number; investmentCount: number;
}

const CATEGORIES = ["Ad Spend", "Shipping", "Materials", "Operations", "Marketing", "Other"];

const inputCls = "w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400";
const modalCls = "fixed inset-0 w-screen h-screen overflow-y-auto bg-black/20 flex items-center justify-center z-50 p-4";
const cardCls = "bg-white border border-zinc-100 rounded-xl p-4";

export default function FinancesPage() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Expense form
  const [showAddExp, setShowAddExp] = useState(false);
  const [expForm, setExpForm] = useState({ category: CATEGORIES[0], amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") });
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [editExpForm, setEditExpForm] = useState({ category: CATEGORIES[0], amount: "", description: "", date: "" });

  // Investment form
  const [showAddInv, setShowAddInv] = useState(false);
  const [invForm, setInvForm] = useState({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const [shareholderFilter, setShareholderFilter] = useState("");
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

  const loadInvestments = useCallback(async () => {
    const res = await fetch("/api/finances/investments");
    const data = await res.json();
    setInvestments(data.investments ?? []);
  }, []);

  const reloadSummary = () => {
    fetch("/api/finances/summary")
      .then((r) => r.json())
      .then((data) => { if (data && typeof data.revenue === "number") setSummary(data); })
      .catch(() => null);
  };

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { loadInvestments(); reloadSummary(); }, [loadInvestments]);

  const addExpense = async () => {
    if (!expForm.amount) return;
    await fetch("/api/finances/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount), date: new Date(expForm.date).toISOString() }),
    });
    setShowAddExp(false);
    setExpForm({ category: CATEGORIES[0], amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") });
    loadExpenses(); reloadSummary();
  };

  const deleteExpense = async (id: string) => {
    await fetch("/api/finances/expenses", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    loadExpenses(); reloadSummary();
  };

  const openEditExp = (e: Expense) => {
    setEditingExp(e);
    setEditExpForm({
      category: e.category,
      amount: String(e.amount),
      description: e.description ?? "",
      date: format(new Date(e.date), "yyyy-MM-dd"),
    });
  };

  const saveEditExp = async () => {
    if (!editingExp || !editExpForm.amount) return;
    await fetch("/api/finances/expenses", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingExp.id,
        category: editExpForm.category,
        amount: parseFloat(editExpForm.amount),
        description: editExpForm.description || null,
        date: new Date(editExpForm.date).toISOString(),
      }),
    });
    setEditingExp(null);
    loadExpenses(); reloadSummary();
  };

  const addInvestment = async () => {
    if (!invForm.name || !invForm.amount) return;
    await fetch("/api/finances/investments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invForm, amount: parseFloat(invForm.amount), date: new Date(invForm.date).toISOString() }),
    });
    setShowAddInv(false);
    setInvForm({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    loadInvestments(); reloadSummary();
  };

  const deleteInvestment = async (id: string) => {
    await fetch("/api/finances/investments", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    loadInvestments(); reloadSummary();
  };

  const exportToSheets = async () => {
    setExporting(true);
    const res = await fetch("/api/finances/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }),
    });
    const data = await res.json();
    if (data.ok) setExportMsg(`Exported · Revenue ${data.revenue?.toLocaleString()} · Expenses ${data.totalExpenses?.toLocaleString()} · Profit ${data.profit?.toLocaleString()} EGP`);
    setExporting(false);
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Finances</h1>
          <p className="text-sm text-zinc-500 mt-0.5">P&L, expenses, and investments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none">
            <option value="all">All time</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
          </select>
          <button onClick={() => setShowAddExp(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
            <Plus size={13} /> Add Expense
          </button>
          <button onClick={() => setShowAddInv(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors">
            <Users size={13} /> Add Investment
          </button>
          <button onClick={exportToSheets} disabled={exporting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600 transition-colors disabled:opacity-40">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {exportMsg && <div className="text-xs text-green-700 bg-green-50 rounded-lg px-4 py-2">{exportMsg}</div>}

      {/* All-time P&L summary */}
      {summary && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">All-time P&L</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cardCls}>
              <div className="flex items-center gap-1.5 mb-2"><ShoppingBag size={13} className="text-emerald-500" /><p className="text-xs text-zinc-400">Revenue</p></div>
              <p className="text-xl font-semibold text-emerald-600">{summary.revenue.toLocaleString()} EGP</p>
              <p className="text-[10px] text-zinc-400 mt-1">{summary.paidOrderCount} paid orders</p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-1.5 mb-2"><TrendingDown size={13} className="text-red-400" /><p className="text-xs text-zinc-400">Expenses</p></div>
              <p className="text-xl font-semibold text-red-500">{summary.totalExpenses.toLocaleString()} EGP</p>
              <p className="text-[10px] text-zinc-400 mt-1">{Object.keys(summary.byCategory).length} categories</p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className={summary.profit >= 0 ? "text-emerald-500" : "text-red-400"} />
                <p className="text-xs text-zinc-400">Net P&L</p>
              </div>
              <p className={`text-xl font-semibold ${summary.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {summary.profit >= 0 ? "+" : ""}{summary.profit.toLocaleString()} EGP
              </p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-1.5 mb-2"><Package size={13} className="text-amber-500" /><p className="text-xs text-zinc-400">Stock Value</p></div>
              <p className="text-xl font-semibold text-amber-600">{summary.stockValue.toLocaleString()} EGP</p>
              <p className="text-[10px] text-zinc-400 mt-1">{summary.stockItemCount} items</p>
            </div>
          </div>
          {/* Actual Profit highlight */}
          {(() => {
            const actualProfit = summary.revenue + summary.stockValue - summary.totalExpenses;
            return (
              <div className={`rounded-xl p-4 border ${actualProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-xs text-zinc-500 mb-1">Actual Profit = Net Revenue + Stock Value − Expenses</p>
                <p className={`text-3xl font-bold ${actualProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {actualProfit >= 0 ? "+" : ""}{actualProfit.toLocaleString()} EGP
                </p>
                <div className="flex gap-4 mt-2 text-[11px] text-zinc-400">
                  <span>Revenue {summary.revenue.toLocaleString()}</span>
                  <span>+ Stock {summary.stockValue.toLocaleString()}</span>
                  <span>− Exp {summary.totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}

          <div className={`${cardCls} flex flex-wrap gap-2`}>
            {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-zinc-600 font-medium">{cat}</span>
                <span className="text-xs text-zinc-400">{amt.toLocaleString()} EGP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shareholder Investments */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Shareholder Investments</p>
          <p className="text-sm font-semibold text-purple-600">{totalInvested.toLocaleString()} EGP total</p>
        </div>

        {/* Per-shareholder totals — Radwa & Mostafa always first */}
        {investments.length > 0 && (() => {
          const byName: Record<string, number> = {};
          investments.forEach((inv) => { byName[inv.name] = (byName[inv.name] ?? 0) + inv.amount; });
          const PINNED = ["Radwa", "Mostafa"];
          const sorted = Object.entries(byName).sort((a, b) => {
            const aPin = PINNED.findIndex((p) => a[0].toLowerCase().includes(p.toLowerCase()));
            const bPin = PINNED.findIndex((p) => b[0].toLowerCase().includes(p.toLowerCase()));
            if (aPin !== -1 && bPin !== -1) return aPin - bPin;
            if (aPin !== -1) return -1;
            if (bPin !== -1) return 1;
            return b[1] - a[1];
          });
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sorted.map(([name, total]) => (
                <div key={name} className={`${cardCls} flex flex-col gap-0.5`}>
                  <p className="text-xs font-semibold text-zinc-700 truncate">{name}</p>
                  <p className="text-lg font-bold text-purple-600">{total.toLocaleString()} EGP</p>
                  <p className="text-[10px] text-zinc-400">
                    {investments.filter((i) => i.name === name).length} transaction{investments.filter((i) => i.name === name).length !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="flex items-center gap-2">
          <input
            value={shareholderFilter}
            onChange={(e) => setShareholderFilter(e.target.value)}
            placeholder="Filter by shareholder name…"
            className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-zinc-400"
          />
          {shareholderFilter && (
            <button onClick={() => setShareholderFilter("")} className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1.5">Clear</button>
          )}
        </div>
        {investments.length === 0 ? (
          <div className={`${cardCls} text-center py-6 text-sm text-zinc-400`}>No investments yet</div>
        ) : (
          <div className={`${cardCls} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  {["Shareholder", "Amount", "Date", "Notes", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investments
                  .filter((inv) => !shareholderFilter || inv.name.toLowerCase().includes(shareholderFilter.toLowerCase()))
                  .map((inv) => (
                  <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{inv.name}</td>
                    <td className="px-4 py-3 font-semibold text-purple-600">{inv.amount.toLocaleString()} {inv.currency}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{format(new Date(inv.date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs truncate max-w-[100px]">{inv.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteInvestment(inv.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expenses for selected month */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Expenses — {month === "all" ? "All time" : month}
          </p>
          <p className="text-sm font-semibold text-zinc-700">{totalExpenses.toLocaleString()} EGP · {expenses.length} entries</p>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-10">No expenses for this period.</p>
        ) : (
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 w-[22%]">Category</th>
                  <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 w-[22%]">Amount</th>
                  <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 hidden sm:table-cell">Description</th>
                  <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 w-[22%]">Date</th>
                  <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-700 truncate">{e.category}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 truncate">{e.amount.toLocaleString()} {e.currency}</td>
                    <td className="px-4 py-3 text-zinc-500 truncate hidden sm:table-cell">{e.description ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs truncate">{format(new Date(e.date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 w-[60px]">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditExp(e)} className="text-zinc-300 hover:text-zinc-500 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteExpense(e.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExp && (
        <div className={modalCls} onClick={() => setShowAddExp(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-4">Add Expense</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount (EGP)</label>
                <input type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Description</label>
                <input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className={inputCls} placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} className={inputCls} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddExp(false)} className="flex-1 border border-zinc-200 rounded-lg py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={addExpense} className="flex-1 bg-zinc-900 text-white rounded-lg py-2 text-sm hover:bg-zinc-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExp && (
        <div className={modalCls} onClick={() => setEditingExp(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-4">Edit Expense</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <select value={editExpForm.category} onChange={(e) => setEditExpForm({ ...editExpForm, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount (EGP)</label>
                <input type="number" value={editExpForm.amount} onChange={(e) => setEditExpForm({ ...editExpForm, amount: e.target.value })} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Description</label>
                <input value={editExpForm.description} onChange={(e) => setEditExpForm({ ...editExpForm, description: e.target.value })} className={inputCls} placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input type="date" value={editExpForm.date} onChange={(e) => setEditExpForm({ ...editExpForm, date: e.target.value })} className={inputCls} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingExp(null)} className="flex-1 border border-zinc-200 rounded-lg py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={saveEditExp} className="flex-1 bg-zinc-900 text-white rounded-lg py-2 text-sm hover:bg-zinc-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Investment Modal */}
      {showAddInv && (
        <div className={modalCls} onClick={() => setShowAddInv(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-4">Add Shareholder Investment</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Shareholder Name</label>
                <input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })} className={inputCls} placeholder="e.g. Mostafa" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount (EGP)</label>
                <input type="number" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input type="date" value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                <input value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} className={inputCls} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddInv(false)} className="flex-1 border border-zinc-200 rounded-lg py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={addInvestment} className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm hover:bg-purple-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
