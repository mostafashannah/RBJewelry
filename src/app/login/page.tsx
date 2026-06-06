"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || undefined, password }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(data.role === "LIMITED" ? "/inventory" : "/dashboard");
    } else {
      setError(data.error ?? "Incorrect credentials");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-8">
          <p className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: "#c9a96e" }}>
            RB Jewelry
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">Sign In</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">
              Email <span className="text-zinc-300">(staff only — leave blank for admin)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-400"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors mt-1"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-zinc-100">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password: "demo" }),
                });
                const data = await res.json();
                if (res.ok) {
                  router.push("/inventory");
                } else {
                  setError(data.error ?? "Demo unavailable");
                  setLoading(false);
                }
              } catch {
                setError("Network error — try again");
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full border border-zinc-200 text-zinc-500 rounded-xl py-2.5 text-sm hover:bg-zinc-50 disabled:opacity-40 transition-colors"
          >
            👁 View as Demo
          </button>
          <p className="text-center text-[10px] text-zinc-400 mt-2">Read-only · Inventory & Finances only · 2h session</p>
        </div>
      </div>
    </div>
  );
}
