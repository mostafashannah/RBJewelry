"use client";
import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, MessageCircle, RefreshCw } from "lucide-react";
// Instagram icon via SVG since lucide-react uses a different export name
const InstagramIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

interface Message {
  id: string;
  body: string;
  direction: "INBOUND" | "OUTBOUND";
  isAiGenerated: boolean;
  sentAt: string;
}

interface Conversation {
  id: string;
  platform: "INSTAGRAM_DM" | "INSTAGRAM_COMMENT" | "WHATSAPP" | "FACEBOOK_DM" | "FACEBOOK_COMMENT";
  externalId: string;
  displayName: string | null;
  unreadCount: number;
  lastMessageAt: string;
  status: string;
  messages: Message[];
}

const platformIcon = (p: string) => {
  if (p.startsWith("INSTAGRAM")) return <InstagramIcon />;
  if (p.startsWith("FACEBOOK")) return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
  return <MessageCircle size={13} className="text-green-600" />;
};

const platformLabel = (p: string) => {
  if (p === "INSTAGRAM_DM") return "IG DM";
  if (p === "INSTAGRAM_COMMENT") return "IG Comment";
  if (p === "FACEBOOK_DM") return "FB Message";
  if (p === "FACEBOOK_COMMENT") return "FB Comment";
  return "WhatsApp";
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inbox");
    const data = await res.json();
    setConversations(data.conversations ?? []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/inbox/${id}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    // Mark as read
    await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unreadCount: 0 }),
    });
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const selectConversation = (conv: Conversation) => {
    setSelected(conv);
    loadMessages(conv.id);
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const endpoint =
      selected.platform === "WHATSAPP"
        ? "/api/meta/send/whatsapp"
        : selected.platform.startsWith("FACEBOOK")
        ? "/api/meta/send/facebook"
        : "/api/meta/send/instagram";
    const body: Record<string, string> = {
      conversationId: selected.id,
      message: reply.trim(),
    };
    if (selected.platform === "INSTAGRAM_DM") body.type = "dm";
    if (selected.platform === "INSTAGRAM_COMMENT") body.type = "comment";

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setReply("");
    await loadMessages(selected.id);
    setSending(false);
  };

  const filtered = filter === "all" ? conversations : conversations.filter((c) => c.platform === filter);

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="w-72 shrink-0 border-r border-zinc-100 flex flex-col bg-white">
        <div className="p-4 border-b border-zinc-100">
          <h1 className="text-sm font-semibold text-zinc-900 mb-3">Inbox</h1>
          <div className="flex gap-1">
            {["all", "INSTAGRAM_DM", "INSTAGRAM_COMMENT", "FACEBOOK_DM", "FACEBOOK_COMMENT", "WHATSAPP"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  filter === f ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {f === "all" ? "All" : platformLabel(f)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <RefreshCw size={14} className="text-zinc-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center mt-8">No conversations yet</p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${
                  selected?.id === conv.id ? "bg-zinc-50" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {platformIcon(conv.platform)}
                    <span className="text-xs font-medium text-zinc-700 truncate max-w-[120px]">
                      {conv.displayName ?? conv.externalId}
                    </span>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="text-xs bg-zinc-900 text-white rounded-full w-4 h-4 flex items-center justify-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread view */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-zinc-100 bg-white px-6 flex items-center gap-2">
            {platformIcon(selected.platform)}
            <span className="text-sm font-medium text-zinc-900">
              {selected.displayName ?? selected.externalId}
            </span>
            <span className="text-xs text-zinc-400 ml-1">{platformLabel(selected.platform)}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                    msg.direction === "OUTBOUND"
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-100 text-zinc-800"
                  }`}
                >
                  {msg.body}
                  {msg.isAiGenerated && (
                    <span className="block text-[10px] mt-1 opacity-50">AI</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-zinc-100 bg-white">
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                rows={2}
                className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-zinc-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">⌘ + Enter to send</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-400">
          <p className="text-sm">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
