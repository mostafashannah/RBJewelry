"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingBag,
  BarChart2,
  Megaphone,
  Wallet,
  Settings,
  ClipboardList,
  Boxes,
  LogOut,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-100 bg-white flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#c9a96e" }}>
            RB Jewelry
          </span>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-zinc-50 text-zinc-900 font-medium"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between">
          <p className="text-xs text-zinc-400">rbjewelry.co</p>
          <button onClick={logout} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
