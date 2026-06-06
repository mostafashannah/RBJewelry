"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, MessageSquare, Package, ShoppingBag, BarChart2,
  Megaphone, Wallet, Settings, ClipboardList, Boxes, LogOut, Menu, X,
} from "lucide-react";

const nav = [
  { href: "/dashboard",  label: "Overview",   icon: LayoutDashboard },
  { href: "/inbox",      label: "Inbox",       icon: MessageSquare },
  { href: "/products",   label: "Products",    icon: Package },
  { href: "/inventory",  label: "Inventory",   icon: Boxes },
  { href: "/orders",     label: "Orders",      icon: ShoppingBag },
  { href: "/ads",        label: "Ads",         icon: Megaphone },
  { href: "/analytics",  label: "Analytics",   icon: BarChart2 },
  { href: "/finances",   label: "Finances",    icon: Wallet },
  { href: "/reports",    label: "Reports",     icon: ClipboardList },
  { href: "/settings",   label: "Settings",    icon: Settings },
];

// Bottom nav shows 5 most-used items on mobile
const bottomNav = [
  { href: "/inbox",     label: "Inbox",     icon: MessageSquare },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/orders",    label: "Orders",    icon: ShoppingBag },
  { href: "/finances",  label: "Finances",  icon: Wallet },
  { href: "/dashboard", label: "More",      icon: LayoutDashboard },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active ? "bg-zinc-50 text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-zinc-100 bg-white flex-col">
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#c9a96e" }}>
            RB Jewelry
          </span>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between">
          <p className="text-xs text-zinc-400">rbjewelry.co</p>
          <button onClick={logout} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-100">
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#c9a96e" }}>
            RB Jewelry
          </span>
          <button onClick={() => setMobileOpen(false)} className="text-zinc-400">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          <NavLinks onClick={() => setMobileOpen(false)} />
        </nav>
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between">
          <p className="text-xs text-zinc-400">rbjewelry.co</p>
          <button onClick={logout} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-12 bg-white border-b border-zinc-100 flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-zinc-500 p-1">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#c9a96e" }}>
            RB Jewelry
          </span>
          <div className="w-7" />
        </header>

        {/* Page content — extra bottom padding for iPhone home bar */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav — sits above iPhone home indicator */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 flex z-30"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {bottomNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  active ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                <Icon size={20} />
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
