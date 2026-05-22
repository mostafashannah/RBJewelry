"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

interface AiConfig {
  id: string;
  systemPrompt: string;
  autoReplyEnabled: boolean;
  platforms: string[];
  maxTokens: number;
  temperature: number;
}

const ALL_PLATFORMS = ["INSTAGRAM_DM", "INSTAGRAM_COMMENT", "WHATSAPP"];

export default function SettingsPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    await fetch("/api/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const syncProducts = async () => {
    setSyncing(true);
    const res = await fetch("/api/shopify/sync", { method: "POST" });
    const data = await res.json();
    setSyncMsg(data.ok ? "Products synced to AI context!" : "Sync failed.");
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  };

  if (!config) return <div className="p-8 text-sm text-zinc-400">Loading settings…</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure AI agent and integrations</p>
      </div>

      {/* AI Config */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">AI Agent</h2>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-zinc-700">Auto-reply enabled</p>
            <p className="text-xs text-zinc-400">AI will automatically reply to new messages</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, autoReplyEnabled: !config.autoReplyEnabled })}
            className={`w-10 h-6 rounded-full transition-colors ${config.autoReplyEnabled ? "bg-zinc-900" : "bg-zinc-200"}`}
          >
            <span
              className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform ${
                config.autoReplyEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 mb-1.5 block">Active platforms</label>
          <div className="flex gap-2">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  const platforms = config.platforms.includes(p)
                    ? config.platforms.filter((x) => x !== p)
                    : [...config.platforms, p];
                  setConfig({ ...config, platforms });
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  config.platforms.includes(p)
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                }`}
              >
                {p === "INSTAGRAM_DM" ? "IG DM" : p === "INSTAGRAM_COMMENT" ? "IG Comments" : "WhatsApp"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 mb-1.5 block">Max reply length (tokens)</label>
          <input
            type="number"
            value={config.maxTokens}
            onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
            min={100}
            max={1000}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none"
          />
        </div>

        <div className="mb-5">
          <label className="text-xs text-zinc-500 mb-1.5 block">System prompt</label>
          <textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            rows={8}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono resize-y focus:outline-none focus:border-zinc-400"
          />
          <p className="text-xs text-zinc-400 mt-1">This is sent to Claude as the system prompt before every reply.</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          <Save size={14} />
          {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Shopify Sync */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">Shopify Product Sync</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Sync your Shopify product catalog to the AI context cache. Do this after adding or updating products.
        </p>
        {syncMsg && <p className="text-xs text-green-700 mb-3">{syncMsg}</p>}
        <button
          onClick={syncProducts}
          disabled={syncing}
          className="flex items-center gap-2 text-sm px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync Products Now"}
        </button>
      </div>

      {/* Webhook info */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Webhook Endpoints</h2>
        <p className="text-xs text-zinc-500 mb-3">Register these URLs in Meta Developer Console and Shopify Admin:</p>
        <div className="space-y-2">
          {[
            { label: "Instagram", path: "/api/webhooks/instagram" },
            { label: "WhatsApp", path: "/api/webhooks/whatsapp" },
            { label: "Shopify", path: "/api/webhooks/shopify" },
          ].map((w) => (
            <div key={w.label} className="flex items-center justify-between py-1">
              <span className="text-xs text-zinc-500">{w.label}</span>
              <code className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-1 rounded text-zinc-700">
                https://yourdomain.com{w.path}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
