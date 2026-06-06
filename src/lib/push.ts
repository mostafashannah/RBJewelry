import webpush from "web-push";
import { db } from "@/lib/db";

function setupVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@rbjewelry.co",
    pub, priv,
  );
  return true;
}

export async function sendPushToAll(title: string, body: string, url = "/orders") {
  if (!setupVapid()) { console.warn("[push] VAPID not configured"); return; }
  const subs = await db.pushSubscription.findMany();
  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { auth: string; p256dh: string } },
          payload,
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }),
  );
}
