"use client";

import { useState, useEffect } from "react";

interface UnansweredItem {
  conversationId: string;
  question: string;
  botReply: string;
  reason: string;
}

interface TopicItem {
  topic: string;
  count: number;
}

interface ReportStats {
  totalConversations: number;
  totalMessages: number;
  inboundMessages: number;
  aiReplies: number;
  date: string;
}

interface Report {
  id: string;
  reportDate: string;
  summary: string;
  stats: ReportStats;
  unanswered: UnansweredItem[];
  topTopics: TopicItem[];
  createdAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    setLoading(true);
    const res = await fetch("/api/admin/daily-report");
    const data = await res.json();
    setReports(data.reports ?? []);
    if (data.reports?.length) setSelected(data.reports[0]);
    setLoading(false);
  }

  async function generateReport() {
    setGenerating(true);
    const res = await fetch("/api/admin/daily-report", { method: "POST" });
    const data = await res.json();
    if (data.report) {
      setReports((prev) => {
        const filtered = prev.filter((r) => r.reportDate !== data.report.reportDate);
        return [data.report, ...filtered];
      });
      setSelected(data.report);
    }
    setGenerating(false);
  }

  useEffect(() => { loadReports(); }, []);

  const report = selected;

  return (
    <div className="flex h-full">
      {/* Sidebar — report list */}
      <div className="w-52 border-r border-zinc-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-100">
          <button
            onClick={generateReport}
            disabled={generating}
            className="w-full bg-zinc-900 text-white text-sm font-medium rounded-lg px-3 py-2 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : "Generate Today's Report"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-zinc-400 p-4">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-zinc-400 p-4">No reports yet.</p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${
                  selected?.id === r.id ? "bg-zinc-50 font-medium" : ""
                }`}
              >
                <p className="text-sm text-zinc-900">{r.reportDate}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {(r.stats as ReportStats).totalConversations} convs
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8">
        {!report ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-400 text-sm">No report selected.</p>
            <p className="text-zinc-400 text-xs mt-1">Click &quot;Generate Today&apos;s Report&quot; to start.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">
                Daily Report — {report.reportDate}
              </h1>
              <p className="text-zinc-500 text-sm mt-1">{report.summary}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Conversations", value: report.stats.totalConversations },
                { label: "Messages received", value: report.stats.inboundMessages },
                { label: "Total messages", value: report.stats.totalMessages },
                { label: "AI replies sent", value: report.stats.aiReplies },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-50 rounded-xl p-4">
                  <p className="text-2xl font-semibold text-zinc-900">{s.value}</p>
                  <p className="text-xs text-zinc-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Top topics */}
            {report.topTopics.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-zinc-700 mb-3">Top Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {(report.topTopics as TopicItem[]).map((t) => (
                    <span
                      key={t.topic}
                      className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs px-3 py-1.5 rounded-full"
                    >
                      {t.topic}
                      <span className="bg-zinc-300 text-zinc-700 rounded-full px-1.5 text-xs font-medium">
                        {t.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unanswered questions */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-700 mb-3">
                Questions that need attention
                {report.unanswered.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                    {report.unanswered.length}
                  </span>
                )}
              </h2>
              {report.unanswered.length === 0 ? (
                <p className="text-zinc-400 text-sm">All questions were handled well today 🎉</p>
              ) : (
                <div className="space-y-3">
                  {(report.unanswered as UnansweredItem[]).map((item, i) => (
                    <div key={i} className="border border-zinc-100 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-medium text-zinc-900">&quot;{item.question}&quot;</p>
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium text-zinc-700">Bot replied:</span> {item.botReply}
                      </p>
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1 inline-block">
                        ⚠ {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
