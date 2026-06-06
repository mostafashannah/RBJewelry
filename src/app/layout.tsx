import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RB Jewelry",
  description: "RB Jewelry management dashboard",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RB Jewelry" },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [{ url: "/icon-192.png", sizes: "192x192" }, { url: "/icon-512.png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#c9a96e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('/sw.js').then(async (reg) => {
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                const key = '${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}';
                if (!key) return;
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: key,
                });
                await fetch('/api/push/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(sub),
                });
              }
            }).catch(() => {});
          }
        `}} />
      </body>
    </html>
  );
}
