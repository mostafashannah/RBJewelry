"use client";
import { useEffect, useState } from "react";
import type { MetaCampaign } from "@/lib/meta/ads";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  ARCHIVED: "bg-zinc-100 text-zinc-500",
};

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("last_30d");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta/ads?datePreset=${datePreset}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setCampaigns(d.campaigns ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [datePreset]);

  const totals = campaigns.reduce(
    (acc, c) => {
      const ins = c.insights?.data[0];
      return {
        spend: acc.spend + parseFloat(ins?.spend ?? "0"),
        impressions: acc.impressions + parseInt(ins?.impressions ?? "0"),
        clicks: acc.clicks + parseInt(ins?.clicks ?? "0"),
        reach: acc.reach + parseInt(ins?.reach ?? "0"),
      };
    },
    { spend: 0, impressions: 0, clicks: 0, reach: 0 }
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Ads</h1>
          <p className="text-sm text-zinc-500 mt-1">Meta Ads Manager — campaign performance</p>
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none"
        >
          {["last_7d", "last_30d", "last_90d", "this_month", "last_month"].map((p) => (
            <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {!loading && !error && campaigns.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Spend", value: `$${totals.spend.toFixed(2)}` },
            { label: "Impressions", value: totals.impressions.toLocaleString() },
            { label: "Clicks", value: totals.clicks.toLocaleString() },
            { label: "Reach", value: totals.reach.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-zinc-100 rounded-xl p-4">
              <p className="text-xs text-zinc-400">{s.label}</p>
              <p className="text-xl font-semibold text-zinc-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-400 text-center py-20">Loading campaigns…</p>}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl p-4">
          Failed to load ads: {error}. Make sure META_USER_ACCESS_TOKEN and META_AD_ACCOUNT_ID are set.
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-20">No campaigns found.</p>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Campaign", "Status", "Spend", "Impressions", "Clicks", "CTR"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const ins = c.insights?.data[0];
                return (
                  <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900 max-w-[200px] truncate">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[c.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">${parseFloat(ins?.spend ?? "0").toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-500">{parseInt(ins?.impressions ?? "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-500">{parseInt(ins?.clicks ?? "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-500">{parseFloat(ins?.ctr ?? "0").toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
