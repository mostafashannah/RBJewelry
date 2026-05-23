"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw, Save } from "lucide-react";

interface AiConfig {
  id: string;
  systemPrompt: string;
  autoReplyEnabled: boolean;
  platforms: string[];
  maxTokens: number;
  temperature: number;
}

// ── Connections ──────────────────────────────────────────────────────────────

interface ConnectionStatus {
  SHOPIFY_STORE_DOMAIN: boolean;
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: boolean;
  META_PAGE_ACCESS_TOKEN: boolean;
  META_APP_SECRET: boolean;
  META_INSTAGRAM_BUSINESS_ACCOUNT_ID: boolean;
  META_WHATSAPP_PHONE_NUMBER_ID: boolean;
}

interface ConnectionValues {
  SHOPIFY_STORE_DOMAIN: string;
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: string;
  META_PAGE_ACCESS_TOKEN: string;
  META_APP_SECRET: string;
  META_INSTAGRAM_BUSINESS_ACCOUNT_ID: string;
  META_WHATSAPP_PHONE_NUMBER_ID: string;
}

const EMPTY_CONNECTIONS: ConnectionValues = {
  SHOPIFY_STORE_DOMAIN: "",
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: "",
  META_PAGE_ACCESS_TOKEN: "",
  META_APP_SECRET: "",
  META_INSTAGRAM_BUSINESS_ACCOUNT_ID: "",
  META_WHATSAPP_PHONE_NUMBER_ID: "",
};

function StatusBadge({ set }: { set: boolean }) {
  return set ? (
    <span className="text-xs text-green-600 font-medium">Connected ✓</span>
  ) : (
    <span className="text-xs text-zinc-400">Not set</span>
  );
}

function ConnectionField({
  label,
  envKey,
  placeholder,
  isSet,
  value,
  onChange,
}: {
  label: string;
  envKey: keyof ConnectionValues;
  placeholder: string;
  isSet: boolean;
  value: string;
  onChange: (key: keyof ConnectionValues, val: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-500">{label}</label>
        <StatusBadge set={isSet} />
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={isSet ? "••••••••••••  (leave blank to keep current)" : placeholder}
          value={value}
          onChange={(e) => onChange(envKey, e.target.value)}
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:border-zinc-400 placeholder:text-zinc-300"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

const ALL_PLATFORMS = [
  { id: "INSTAGRAM_DM", label: "Instagram DM" },
  { id: "INSTAGRAM_COMMENT", label: "Instagram Comments" },
  { id: "FACEBOOK_DM", label: "Facebook Message" },
  { id: "FACEBOOK_COMMENT", label: "Facebook Comments" },
  { id: "WHATSAPP", label: "WhatsApp" },
];

const WEBHOOKS = [
  { label: "Instagram", path: "/api/webhooks/instagram" },
  { label: "Facebook", path: "/api/webhooks/facebook" },
  { label: "WhatsApp", path: "/api/webhooks/whatsapp" },
  { label: "Shopify", path: "/api/webhooks/shopify" },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [appUrl, setAppUrl] = useState("");

  // Connections
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);
  const [connValues, setConnValues] = useState<ConnectionValues>(EMPTY_CONNECTIONS);
  const [connSaving, setConnSaving] = useState(false);
  const [connMsg, setConnMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/ai/config").then((r) => r.json()).then(setConfig);
    setAppUrl(window.location.origin);
    fetch("/api/settings/connections")
      .then((r) => r.json())
      .then((d) => setConnStatus(d.status ?? null));
  }, []);

  const updateConn = (key: keyof ConnectionValues, val: string) =>
    setConnValues((prev) => ({ ...prev, [key]: val }));

  const saveConnections = async () => {
    setConnSaving(true);
    setConnMsg(null);
    const res = await fetch("/api/settings/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connValues),
    });
    const data = await res.json();
    if (data.ok) {
      setConnMsg({ ok: true, text: data.message });
      // Refresh status
      fetch("/api/settings/connections")
        .then((r) => r.json())
        .then((d) => setConnStatus(d.status ?? null));
      setConnValues(EMPTY_CONNECTIONS);
    } else {
      setConnMsg({ ok: false, text: data.error ?? "Save failed." });
    }
    setConnSaving(false);
    setTimeout(() => setConnMsg(null), 6000);
  };

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
    setSyncMsg(data.ok ? `Synced ${data.count ?? ""} products to AI context.` : "Sync failed.");
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  };

  const togglePlatform = (id: string) => {
    if (!config) return;
    const platforms = config.platforms.includes(id)
      ? config.platforms.filter((x) => x !== id)
      : [...config.platforms, id];
    setConfig({ ...config, platforms });
  };

  if (!config) return <div className="p-8 text-sm text-zinc-400">Loading settings…</div>;

  return (
    <div className="p-8 max-w-2xl space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure AI agent and integrations</p>
      </div>

      {/* AI Agent */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-5">AI Agent</h2>

        {/* Auto-reply toggle */}
        <div className="flex items-center justify-between mb-5 pb-5 border-b border-zinc-50">
          <div>
            <p className="text-sm text-zinc-700 font-medium">Auto-reply</p>
            <p className="text-xs text-zinc-400 mt-0.5">AI automatically replies to new messages</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, autoReplyEnabled: !config.autoReplyEnabled })}
            className={`w-10 h-6 rounded-full transition-colors ${config.autoReplyEnabled ? "bg-zinc-900" : "bg-zinc-200"}`}
          >
            <span className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform ${config.autoReplyEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Active platforms */}
        <div className="mb-5 pb-5 border-b border-zinc-50">
          <label className="text-xs font-medium text-zinc-500 mb-2 block">Active platforms</label>
          <p className="text-xs text-zinc-400 mb-3">AI will only auto-reply on selected platforms</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`text-xs px-3 py-2 rounded-lg border text-left transition-colors ${
                  config.platforms.includes(p.id)
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max tokens */}
        <div className="mb-5 pb-5 border-b border-zinc-50">
          <label className="text-xs font-medium text-zinc-500 mb-1 block">Max reply length (tokens)</label>
          <p className="text-xs text-zinc-400 mb-2">100 = very short, 400 = normal, 1000 = detailed</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm text-zinc-700 w-10 text-right">{config.maxTokens}</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="mb-5 pb-5 border-b border-zinc-50">
          <label className="text-xs font-medium text-zinc-500 mb-1 block">Creativity (temperature)</label>
          <p className="text-xs text-zinc-400 mb-2">0 = consistent & precise, 1 = creative & varied</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm text-zinc-700 w-10 text-right">{config.temperature.toFixed(1)}</span>
          </div>
        </div>

        {/* System prompt */}
        <div className="mb-5">
          <label className="text-xs font-medium text-zinc-500 mb-1 block">System prompt</label>
          <p className="text-xs text-zinc-400 mb-2">
            Define the bot&apos;s name, personality, and rules. The product catalog is automatically appended.
          </p>
          <textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            rows={10}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono resize-y focus:outline-none focus:border-zinc-400"
          />
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
      <div className="bg-white border border-zinc-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Shopify Product Sync</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Sync your Shopify product catalog so the AI knows current prices and availability.
          Run this after adding or updating products.
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

      {/* Webhook endpoints */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Webhook Endpoints</h2>
        <p className="text-xs text-zinc-500 mb-4">Register these in Meta Developer Console and Shopify Admin:</p>
        <div className="space-y-2">
          {WEBHOOKS.map((w) => (
            <div key={w.label} className="flex items-center justify-between gap-4 py-1.5 border-b border-zinc-50 last:border-0">
              <span className="text-xs text-zinc-500 w-24 shrink-0">{w.label}</span>
              <code
                className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-1 rounded text-zinc-700 truncate cursor-pointer hover:bg-zinc-100"
                onClick={() => navigator.clipboard.writeText(`${appUrl}${w.path}`)}
                title="Click to copy"
              >
                {appUrl}{w.path}
              </code>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-3">Click any URL to copy it.</p>
      </div>

      {/* Connections */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Connections</h2>
        <p className="text-xs text-zinc-500 mb-5">
          Enter API credentials below. Values are saved to <code className="bg-zinc-50 px-1 rounded">.env.local</code>.
          Restart the server after saving for changes to take effect.
        </p>

        {/* Shopify */}
        <div className="mb-5 pb-5 border-b border-zinc-50">
          <p className="text-xs font-semibold text-zinc-700 mb-3">Shopify</p>
          <div className="space-y-3">
            <ConnectionField
              label="Store Domain"
              envKey="SHOPIFY_STORE_DOMAIN"
              placeholder="your-store.myshopify.com"
              isSet={connStatus?.SHOPIFY_STORE_DOMAIN ?? false}
              value={connValues.SHOPIFY_STORE_DOMAIN}
              onChange={updateConn}
            />
            <ConnectionField
              label="Admin API Token"
              envKey="SHOPIFY_ADMIN_API_ACCESS_TOKEN"
              placeholder="shpat_..."
              isSet={connStatus?.SHOPIFY_ADMIN_API_ACCESS_TOKEN ?? false}
              value={connValues.SHOPIFY_ADMIN_API_ACCESS_TOKEN}
              onChange={updateConn}
            />
          </div>
        </div>

        {/* Meta / Facebook */}
        <div className="mb-5 pb-5 border-b border-zinc-50">
          <p className="text-xs font-semibold text-zinc-700 mb-3">Meta / Facebook</p>
          <div className="space-y-3">
            <ConnectionField
              label="Page Access Token"
              envKey="META_PAGE_ACCESS_TOKEN"
              placeholder="EAAOQAg..."
              isSet={connStatus?.META_PAGE_ACCESS_TOKEN ?? false}
              value={connValues.META_PAGE_ACCESS_TOKEN}
              onChange={updateConn}
            />
            <ConnectionField
              label="App Secret"
              envKey="META_APP_SECRET"
              placeholder="App secret from Meta developer console"
              isSet={connStatus?.META_APP_SECRET ?? false}
              value={connValues.META_APP_SECRET}
              onChange={updateConn}
            />
            <ConnectionField
              label="Instagram Business Account ID"
              envKey="META_INSTAGRAM_BUSINESS_ACCOUNT_ID"
              placeholder="1234567890"
              isSet={connStatus?.META_INSTAGRAM_BUSINESS_ACCOUNT_ID ?? false}
              value={connValues.META_INSTAGRAM_BUSINESS_ACCOUNT_ID}
              onChange={updateConn}
            />
          </div>
        </div>

        {/* WhatsApp */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-zinc-700 mb-3">WhatsApp</p>
          <div className="space-y-3">
            <ConnectionField
              label="Phone Number ID"
              envKey="META_WHATSAPP_PHONE_NUMBER_ID"
              placeholder="1234567890"
              isSet={connStatus?.META_WHATSAPP_PHONE_NUMBER_ID ?? false}
              value={connValues.META_WHATSAPP_PHONE_NUMBER_ID}
              onChange={updateConn}
            />
          </div>
        </div>

        {connMsg && (
          <p className={`text-xs mb-3 ${connMsg.ok ? "text-green-700" : "text-red-600"}`}>
            {connMsg.text}
          </p>
        )}

        <button
          onClick={saveConnections}
          disabled={connSaving}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          <Save size={14} />
          {connSaving ? "Saving…" : "Save Connections"}
        </button>
      </div>
    </div>
  );
}
