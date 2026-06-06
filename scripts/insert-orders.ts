import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
const db = new PrismaClient();

const orders = [
  { id: "gid://shopify/Order/6958071644478", name: "#1024", email: "miirazee@gmail.com", phone: "01011446665", total: 1479.0, currency: "EGP", payment: "PENDING", fulfillment: "FULFILLED", customer: "Amira Ahmed", items: [{ title: "Core Ring", quantity: 1 }], tracking: "3561345685", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=3561345685", createdAt: "2026-06-05T16:14:34Z" },
  { id: "gid://shopify/Order/6932395360574", name: "#1023", email: "tahanyahmed992@gmail.com", phone: "01122318681", total: 1679.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Tahany Ahmed", items: [{ title: "Wave Ring", quantity: 1 }], tracking: "6057083114", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=6057083114", createdAt: "2026-05-22T01:53:42Z" },
  { id: "gid://shopify/Order/6919817625918", name: "#1022", email: "laylaelmeligy@gmail.com", phone: "01060034565", total: 1979.0, currency: "EGP", payment: "PENDING", fulfillment: "FULFILLED", customer: "LAYLA MEDHAT MOHAMED", items: [{ title: "Mosaic Ring", quantity: 1 }], tracking: "9836700632", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=9836700632", createdAt: "2026-05-16T15:26:41Z" },
  { id: "gid://shopify/Order/6914842886462", name: "#1021", email: "haneenomo66@gmail.com", phone: "01116639209", total: 1479.0, currency: "EGP", payment: "VOIDED", fulfillment: "FULFILLED", customer: "Haneen Mohamed", items: [{ title: "Core Ring", quantity: 1 }], tracking: "7555941429", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=7555941429", createdAt: "2026-05-13T19:31:48Z" },
  { id: "gid://shopify/Order/6914249851198", name: "#1020", email: "dina_akmal@hotmail.com", phone: "01113103107", total: 979.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Dina Akmal", items: [{ title: "Mini Band Ring", quantity: 1 }], tracking: "2819570842", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=2819570842", createdAt: "2026-05-13T14:29:05Z" },
  { id: "gid://shopify/Order/6908978987326", name: "#1019", email: "sgad@msa.edu.eg", phone: "01224352202", total: 1579.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Sara Fouad", items: [{ title: "Emerald Cut Ring", quantity: 1 }], tracking: "1304769311", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=1304769311", createdAt: "2026-05-10T00:13:55Z" },
  { id: "gid://shopify/Order/6906524860734", name: "#1018", email: null, phone: "01119221214", total: 1999.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Eman Bedier", items: [{ title: "Dotted Ring", quantity: 1 }, { title: "Trio Stone Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-05-08T15:13:13Z" },
  { id: "gid://shopify/Order/6906508280126", name: "#1017", email: null, phone: "01285077155", total: 1999.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Rana Mabrook", items: [{ title: "Dotted Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-05-08T15:07:44Z" },
  { id: "gid://shopify/Order/6905519833406", name: "#1016", email: "dinagamil87@hotmail.com", phone: "01201730643", total: 1579.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Dina Gamil", items: [{ title: "Duo Stone Ring", quantity: 1 }], tracking: "9259425192", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=9259425192", createdAt: "2026-05-07T22:03:33Z" },
  { id: "gid://shopify/Order/6904912445758", name: "#1015", email: "heaven.delicacies@gmail.com", phone: "01010366026", total: 1579.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Olivia Werner", items: [{ title: "Duo Stone Ring", quantity: 1 }], tracking: "1888886161", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=1888886161", createdAt: "2026-05-07T15:17:03Z" },
  { id: "gid://shopify/Order/6897651876158", name: "#1014", email: "diana.evrayem@gmail.com", phone: "01001468258", total: 2179.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Diana Atef", items: [{ title: "Ridge Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-05-03T07:16:53Z" },
  { id: "gid://shopify/Order/6897088201022", name: "#1013", email: "alaae8431@gmail.com", phone: "01069046502", total: 779.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Alaa Elmasry", items: [{ title: "Mini Green Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-05-02T21:46:37Z" },
  { id: "gid://shopify/Order/6896607232318", name: "#1012", email: null, phone: null, total: 2199.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Ahmed Halim", items: [{ title: "Ruby Cuff", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-05-02T16:47:06Z" },
  { id: "gid://shopify/Order/6896212541758", name: "#1011", email: "donya_emad@hotmail.com", phone: "01122599019", total: 3048.2, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Donya Emad", items: [{ title: "Ridge Ring", quantity: 1 }, { title: "Mosaic Ring", quantity: 1 }], tracking: "5201430001", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=5201430001", createdAt: "2026-05-02T11:50:34Z" },
  { id: "gid://shopify/Order/6896144449854", name: "#1010", email: "mennashazly22@gmail.com", phone: "01118637248", total: 1279.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Menna Shazly", items: [{ title: "Duo Stone Ring", quantity: 1 }], tracking: "926651267", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=926651267", createdAt: "2026-05-02T10:31:55Z" },
  { id: "gid://shopify/Order/6894736769342", name: "#1009", email: "aliaa.abdelrahman92@gmail.com", phone: "01112838183", total: 1479.0, currency: "EGP", payment: "PARTIALLY_REFUNDED", fulfillment: "FULFILLED", customer: "Aliaa Arafa", items: [{ title: "Wave Ring", quantity: 1 }], tracking: "712606063", trackingUrl: "https://bosta.co/tracking-shipments?shipment-number=712606063", createdAt: "2026-05-01T15:00:02Z" },
  { id: "gid://shopify/Order/6885655314750", name: "#1008", email: "salmafishier@aucegypt.edu", phone: "01222104288", total: 1479.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "Salma Fishier", items: [{ title: "Wave Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-26T10:51:32Z" },
  { id: "gid://shopify/Order/6885240996158", name: "#1007", email: "rehamsoliman85@yahoo.com", phone: "01099960039", total: 1179.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "ريهام سليمان", items: [{ title: "The Green Emerald Cut Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-26T02:24:17Z" },
  { id: "gid://shopify/Order/6882214674750", name: "#1006", email: "nourakeshk@gmail.com", phone: "01120221188", total: 3048.2, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "NOURA KESHK", items: [{ title: "The Dotted Ring", quantity: 1 }, { title: "The Wave Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-24T05:45:08Z" },
  { id: "gid://shopify/Order/6881364672830", name: "#1005", email: "abdelbaryrana@gmail.com", phone: "01200005572", total: 1479.0, currency: "EGP", payment: "VOIDED", fulfillment: "FULFILLED", customer: "Rana ABDELBARY", items: [{ title: "The Wave Ring", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-23T16:32:48Z" },
  { id: "gid://shopify/Order/6881143128382", name: "#1004", email: "marway123@yahoo.com", phone: "01002472517", total: 1079.0, currency: "EGP", payment: "PAID", fulfillment: "FULFILLED", customer: "marway elsayed", items: [{ title: "The Trio Blue Ring", quantity: 1 }], tracking: "3891101017", trackingUrl: null, createdAt: "2026-04-23T13:57:39Z" },
  { id: "gid://shopify/Order/6869296546110", name: "#1003", email: "eng_m.mahmoud@hotmail.com", phone: "01066463175", total: 3479.0, currency: "EGP", payment: "VOIDED", fulfillment: "UNFULFILLED", customer: "Mostafa Mahmoud", items: [{ title: "The Blue Line Cuff", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-16T00:19:10Z" },
  { id: "gid://shopify/Order/6869289697598", name: "#1002", email: "eng_m.mahmoud@hotmail.com", phone: null, total: 3479.0, currency: "EGP", payment: "VOIDED", fulfillment: "UNFULFILLED", customer: "Mostafa Mahmoud", items: [{ title: "The Blue Line Cuff", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-16T00:11:55Z" },
  { id: "gid://shopify/Order/6869201289534", name: "#1001", email: "radwa.elbarbary@gmail.com", phone: null, total: 7677.0, currency: "EGP", payment: "VOIDED", fulfillment: "UNFULFILLED", customer: "Radwa Elbarbary", items: [{ title: "The Ridge Ring", quantity: 1 }, { title: "The Signet Ring", quantity: 1 }, { title: "The Arabesque Earrings", quantity: 1 }], tracking: null, trackingUrl: null, createdAt: "2026-04-15T22:42:16Z" },
];

async function main() {
  let upserted = 0;
  for (const o of orders) {
    const status = `${o.payment} / ${o.fulfillment}`;
    await db.shopifyOrderCache.upsert({
      where: { id: o.id },
      update: {
        status,
        totalPrice: o.total,
        fulfillmentStatus: o.fulfillment,
        trackingNumber: o.tracking,
        trackingUrl: o.trackingUrl,
        syncedAt: new Date(),
        lineItemsJson: { customerName: o.customer, count: o.items.length, items: o.items },
      },
      create: {
        id: o.id,
        orderNumber: o.name.replace("#", ""),
        customerEmail: o.email,
        customerPhone: o.phone,
        totalPrice: o.total,
        currency: o.currency,
        status,
        fulfillmentStatus: o.fulfillment,
        trackingNumber: o.tracking,
        trackingUrl: o.trackingUrl,
        lineItemsJson: { customerName: o.customer, count: o.items.length, items: o.items },
        createdAt: new Date(o.createdAt),
      },
    });
    upserted++;
  }

  console.log(`✅ Synced ${upserted} orders`);
  const paid = orders.filter(o => o.payment === "PAID");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  console.log(`\nPaid orders: ${paid.length} — Revenue: ${revenue.toLocaleString()} EGP`);
  console.log(`Latest: ${orders[0].name} | ${orders[0].customer} | ${orders[0].total} EGP | ${orders[0].payment}`);
}

main().catch(console.error).finally(() => db.$disconnect());
