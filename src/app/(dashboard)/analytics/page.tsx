"use client";
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

const SUGGESTIONS = [
  "What's my best-selling product type?",
  "What's the average order value?",
  "Which products are low in stock?",
  "How many messages did we receive this week?",
  "What product should I restock first?",
];

export default function AnalyticsPage() {
  const [question, setQuestion] = useState("");
  const [, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const ask = async (q?: string) => {
    const text = q ?? question;
    if (!text.trim()) return;
    setLoading(true);
    setAnswer("");
    const res = await fetch("/api/ai/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    const data = await res.json();
    const ans = data.answer ?? "No answer generated.";
    setHistory((h) => [{ q: text, a: ans }, ...h]);
    setAnswer(ans);
    setQuestion("");
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">AI Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Ask anything about your business</p>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-full text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-8">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask a question…"
          className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>

      {/* History */}
      <div className="space-y-4">
        {history.map((item, i) => (
          <div key={i} className="bg-white border border-zinc-100 rounded-xl p-5">
            <p className="text-sm text-zinc-500 mb-3 font-medium">{item.q}</p>
            <p className="text-sm text-zinc-900 whitespace-pre-line leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
