import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RB Jewelry — Dashboard",
  description: "RB Jewelry management dashboard",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RB Jewelry" },
};

export const viewport: Viewport = {
  themeColor: "#c9a96e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
