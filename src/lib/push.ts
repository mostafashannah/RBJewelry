import webpush from "web-push";
import { db } from "@/lib/db";

let vapidReady = false;

function initVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@rbjewelry.co",
    pub,
    priv,
  );
  vapidReady = true;
  return true;
}

export async function sendPushNotification(title: string, body: string, url = "/inbox") {
  if (!initVapid()) return;

  const subs = await db.pushSubscription.findMany();
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { auth: string; p256dh: string } },
          payload,
        );
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      }
    }),
  );
}
