const CACHE = "rb-jewelry-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { data = { title: "RB Jewelry", body: e.data?.text() ?? "" }; }
  e.waitUntil(
    self.registration.showNotification(data.title ?? "RB Jewelry", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url ?? "/inbox" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.includes(self.location.origin));
      if (existing) {
        existing.navigate(e.notification.data?.url ?? "/inbox");
        return existing.focus();
      }
      return clients.openWindow(e.notification.data?.url ?? "/inbox");
    })
  );
});
