"use client";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Package, ShoppingBag, Users, Send, Loader2, Bell, BellOff } from "lucide-react";
import Link from "next/link";

interface Summary {
  revenue: number;
  totalExpenses: number;
  profit: number;
  stockValue: number;
  stockItemCount: number;
  paidOrderCount: number;
  totalInvested: number;
  investmentCount: number;
  byCategory: Record<string, number>;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"default" | "granted" | "denied">("default");

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission as "default" | "granted" | "denied");
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm as "default" | "granted" | "denied");
    if (perm === "granted") {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) return;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pub,
      });
      await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub),
      });
    }
  };

  useEffect(() => {
    fetch("/api/finances/summary")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.revenue === "number") setSummary(data);
      })
      .catch(() => null);
  }, []);

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer("");
    const res = await fetch("/api/ai/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setAnswer(data.answer ?? data.error ?? "No response");
    setAsking(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">RB Jewelry dashboard</p>
        </div>
        {notifStatus !== "granted" && (
          <button onClick={enableNotifications}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors shrink-0 ${
              notifStatus === "denied"
                ? "border-red-200 text-red-400 bg-red-50"
                : "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
            }`}>
            {notifStatus === "denied" ? <BellOff size={13} /> : <Bell size={13} />}
            {notifStatus === "denied" ? "Notifications blocked" : "Enable Notifications"}
          </button>
        )}
        {notifStatus === "granted" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 shrink-0">
            <Bell size={13} /> Notifications on
          </span>
        )}
      </div>

      {/* Financial P&L */}
      {summary && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Financials</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingBag size={13} className="text-emerald-500" />
                <p className="text-xs text-zinc-400">Revenue</p>
              </div>
              <p className="text-xl font-semibold text-emerald-600">{summary.revenue.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{summary.paidOrderCount} paid orders · EGP</p>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={13} className="text-red-400" />
                <p className="text-xs text-zinc-400">Expenses</p>
              </div>
              <p className="text-xl font-semibold text-red-500">{summary.totalExpenses.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">EGP total</p>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className={summary.profit >= 0 ? "text-emerald-500" : "text-red-400"} />
                <p className="text-xs text-zinc-400">Net P&L</p>
              </div>
              <p className={`text-xl font-semibold ${summary.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {summary.profit >= 0 ? "+" : ""}{summary.profit.toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">EGP</p>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Package size={13} className="text-amber-500" />
                <p className="text-xs text-zinc-400">Stock Value</p>
              </div>
              <p className="text-xl font-semibold text-amber-600">{summary.stockValue.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{summary.stockItemCount} items · EGP cost</p>
            </div>
          </div>

          {summary.totalInvested > 0 && (
            <div className="bg-white border border-zinc-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-purple-500" />
                <span className="text-sm text-zinc-700">Total Invested by Shareholders</span>
              </div>
              <span className="text-sm font-semibold text-purple-600">{summary.totalInvested.toLocaleString()} EGP</span>
            </div>
          )}
        </div>
      )}

      {/* AI Assistant */}
      <div className="bg-white border border-zinc-100 rounded-xl p-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Ask AI</p>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="Ask anything… e.g. What's my best selling category? How much did I spend on ads?"
            className="flex-1 text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-zinc-400 min-w-0"
          />
          <button
            onClick={ask}
            disabled={asking || !question.trim()}
            className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        {answer && (
          <div className="mt-3 text-sm text-zinc-700 bg-zinc-50 rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
            {answer}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/inbox", label: "Open Inbox", sub: "View messages" },
          { href: "/inventory", label: "Inventory", sub: "Manage stock" },
          { href: "/orders", label: "Sync Orders", sub: "Update from Shopify" },
          { href: "/finances", label: "Finances", sub: "P&L & expenses" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white border border-zinc-100 rounded-xl p-4 hover:bg-zinc-50 transition-colors"
          >
            <p className="text-sm font-medium text-zinc-900">{item.label}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{item.sub}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
