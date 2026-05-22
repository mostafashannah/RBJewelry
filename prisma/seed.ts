import { PrismaClient, Platform } from "@prisma/client";

const db = new PrismaClient();

const products = [
  { id: "gid://shopify/Product/12306429903166", handle: "duo-stone-ring", title: "Duo Stone Ring", description: "Two stones. One ring. One look that does more than expected. The Duo Stone Ring pairs two contrasting stones — different in shape, different in finish.", priceMin: 1499, priceMax: 1499, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_92a389d0-184c-4705-a8b3-2369737242b4.png", tags: ["ring","silver","stone ring","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00001-G-6", price: "1499.00", inventory: 0 },{ title: "7", sku: "R00001-G-7", price: "1499.00", inventory: -1 },{ title: "8", sku: "R00001-G-8", price: "1499.00", inventory: 1 },{ title: "9", sku: "R00001-G-9", price: "1499.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12306430165310", handle: "wave-cuff", title: "Wave Cuff", description: "Some pieces you put on and forget you're wearing. The Wave Cuff is one of them. Its soft, irregular wave silhouette wraps the wrist without pinching.", priceMin: 2299, priceMax: 2299, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_0bf2b8fa-7889-4352-8e69-c19b320a8508.png", tags: ["bracelet","cuff","silver","wave","handmade","gift"], available: true, rawJson: { productType: "Bracelet", variants: [{ title: "Default Title", sku: "B00001", price: "2299.00", inventory: 0 }] } },
  { id: "gid://shopify/Product/12319497158974", handle: "mosaic-ring", title: "Mosaic Ring", description: "Color that doesn't shout — it glows. The Mosaic Ring wraps a full band in small colored stones, adding warmth and texture to any stack without overpowering.", priceMin: 1899, priceMax: 1899, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_20eb45c3-c365-48a6-9741-7194b1b0b7fb.png", tags: ["ring","silver","mosaic","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00002-6", price: "1899.00", inventory: 1 },{ title: "7", sku: "R00002-7", price: "1899.00", inventory: -1 },{ title: "8", sku: "R00002-8", price: "1899.00", inventory: 1 },{ title: "9", sku: "R00002-9", price: "1899.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12319500009790", handle: "wave-ring", title: "Wave Ring", description: "Minimal doesn't mean plain. The Wave Ring proves that. A structured open ring shaped into a soft, irregular wave — it moves with your hand.", priceMin: 1599, priceMax: 1599, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_71b22d4b-cf6d-42a8-957c-c46785700e0a.png", tags: ["ring","silver","wave","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00003-6", price: "1599.00", inventory: 4 },{ title: "7", sku: "R00003-7", price: "1599.00", inventory: 4 },{ title: "8", sku: "R00003-8", price: "1599.00", inventory: 5 },{ title: "9", sku: "R00003-9", price: "1599.00", inventory: 4 }] } },
  { id: "gid://shopify/Product/12319526420798", handle: "dotted-ring", title: "Dotted Ring", description: "The best everyday ring is one you forget you're wearing — until someone asks about it. The Dotted Ring has a wider band with a soft dotted texture.", priceMin: 1999, priceMax: 1999, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_a2e8c548-1007-4703-812c-cded3c642aaf.png", tags: ["ring","silver","dotted","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00004-6", price: "1999.00", inventory: 1 },{ title: "7", sku: "R00004-7", price: "1999.00", inventory: -1 },{ title: "8", sku: "R00004-8", price: "1999.00", inventory: 0 },{ title: "9", sku: "R00004-9", price: "1999.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12319542083902", handle: "twin-band-ring", title: "Twin Band Ring", description: "Small details make the biggest difference in a stack. The Twin Band Ring carries two green stones side by side on a delicate band.", priceMin: 1099, priceMax: 1099, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_77c0933f-616e-4737-b262-12ff0cd0cd84.png", tags: ["ring","silver","twin band","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00005-6", price: "1099.00", inventory: 1 },{ title: "7", sku: "R00005-7", price: "1099.00", inventory: 1 },{ title: "8", sku: "R00005-8", price: "1099.00", inventory: 1 },{ title: "9", sku: "R00005-9", price: "1099.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12319550472510", handle: "sunray-earrings", title: "Sunray Earrings", description: "Earrings that frame the face without taking over it. The Sunray Earrings have a round form with a lined texture that catches light as you move.", priceMin: 2699, priceMax: 2699, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_0d7ff3f2-01c8-4d6e-b5e9-188f17520d0a.png", tags: ["earrings","silver","sunray","handmade","gift"], available: true, rawJson: { productType: "Earrings", variants: [{ title: "Green", sku: "E00001-G", price: "2699.00", inventory: 1 },{ title: "Red", sku: "E00001-R", price: "2699.00", inventory: 1 },{ title: "Blue", sku: "E00001-B", price: "2699.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322920464702", handle: "arabesque-earrings", title: "Arabesque Earrings", description: "Not every stud needs to be plain to be wearable every day. The Arabesque Earrings carry an open-cut pattern across a gold surface.", priceMin: 1999, priceMax: 1999, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_db8cde54-45f9-40e9-9036-8f003c5ea164.png", tags: ["earrings","silver","arabesque","handmade","gift"], available: true, rawJson: { productType: "Earrings", variants: [{ title: "Default Title", sku: "E00002", price: "1999.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322924560702", handle: "wave-necklace", title: "Wave Necklace", description: "A necklace that moves the way you do. The Wave Necklace follows a soft, irregular wave shape that sits cleanly against the neckline.", priceMin: 5999, priceMax: 5999, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_92ed5a3b-1403-449c-8c4d-1ddf5a5cf695.png", tags: ["necklace","silver","wave","handmade","gift"], available: true, rawJson: { productType: "Necklace", variants: [{ title: "Default Title", sku: "N00001", price: "5999.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322927182142", handle: "ruby-cuff", title: "Ruby Cuff", description: "Color, structure, and ease — all in one bracelet. The Ruby Cuff is a slim open cuff finished with a stone on each end.", priceMin: 2399, priceMax: 2399, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_f080eab6-9812-4caa-a4d1-aa8f2af8ea54.png", tags: ["bracelet","cuff","ruby","silver","handmade","gift"], available: true, rawJson: { productType: "Bracelet", variants: [{ title: "Default Title", sku: "B00002", price: "2399.00", inventory: -1 }] } },
  { id: "gid://shopify/Product/12322928361790", handle: "linear-cuff", title: "Linear Cuff", description: "Bold color. Clean structure. Zero effort to wear. The Linear Cuff features a row of blue stones across the front of a minimal open cuff.", priceMin: 2899, priceMax: 2899, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_87837dc8-dcdc-4c68-a759-c75ea19a90f2.png", tags: ["bracelet","cuff","linear","silver","handmade","gift"], available: true, rawJson: { productType: "Bracelet", variants: [{ title: "Default Title", sku: "B00003", price: "2899.00", inventory: 0 }] } },
  { id: "gid://shopify/Product/12322930164030", handle: "ridge-ring", title: "Ridge Ring", description: "Texture changes everything. The Ridge Ring takes a full band and gives it depth — a ridged surface that catches light differently depending on how you hold your hand.", priceMin: 2299, priceMax: 2299, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_9ee4ed98-6a6d-4082-bdd0-b266fd86a390.png", tags: ["ring","silver","ridge","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00006-6", price: "2299.00", inventory: 0 },{ title: "7", sku: "R00006-7", price: "2299.00", inventory: 0 },{ title: "8", sku: "R00006-8", price: "2299.00", inventory: 1 },{ title: "9", sku: "R00006-9", price: "2299.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322939601214", handle: "trio-stone-ring", title: "Trio Stone Ring", description: "Three stones. One slim band. A lot of personality for a small piece. The Trio Stone Ring lines up three blue stones in a clean row.", priceMin: 1299, priceMax: 1299, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_0f96907a-7580-4ce1-9389-4028e07dc6ae.png", tags: ["ring","silver","trio stone","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00007-6", price: "1299.00", inventory: 5 },{ title: "7", sku: "R00007-7", price: "1299.00", inventory: 4 },{ title: "8", sku: "R00007-8", price: "1299.00", inventory: 5 },{ title: "9", sku: "R00007-9", price: "1299.00", inventory: 5 }] } },
  { id: "gid://shopify/Product/12322943172926", handle: "signet-ring", title: "Signet Ring", description: "Some rings make a statement. The Signet Ring simply commands respect. A polished gold surface, a solid silhouette, and a weight that feels intentional.", priceMin: 2099, priceMax: 2099, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_ee1e36bb-87e2-4b12-aa94-88a4e051af14.png", tags: ["ring","silver","signet","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00008-6", price: "2099.00", inventory: 1 },{ title: "7", sku: "R00008-7", price: "2099.00", inventory: 1 },{ title: "8", sku: "R00008-8", price: "2099.00", inventory: 1 },{ title: "9", sku: "R00008-9", price: "2099.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322945204542", handle: "marquise-ring", title: "Marquise Ring", description: "The marquise cut was made for people who want something different. The Marquise Ring sets a bold, elongated blue stone on a clean gold band.", priceMin: 1699, priceMax: 1699, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_28deb227-04b1-4743-8b23-96e80cacaa6e.png", tags: ["ring","silver","marquise","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00009-6", price: "1699.00", inventory: 1 },{ title: "7", sku: "R00009-7", price: "1699.00", inventory: 1 },{ title: "8", sku: "R00009-8", price: "1699.00", inventory: 1 },{ title: "9", sku: "R00009-9", price: "1699.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322950840638", handle: "mini-band-ring", title: "Mini Band Ring", description: "The ring you never take off. The Mini Band Ring is slim, light, and finished with a small green stone that adds just enough color.", priceMin: 899, priceMax: 899, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2_5237027f-4a4c-4986-87e4-b86d86711c27.png", tags: ["ring","silver","mini band","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00010-6", price: "899.00", inventory: 1 },{ title: "7", sku: "R00010-7", price: "899.00", inventory: 0 },{ title: "8", sku: "R00010-8", price: "899.00", inventory: 0 },{ title: "9", sku: "R00010-9", price: "899.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322952708414", handle: "core-ring", title: "Core Ring", description: "Classic shape. Fresh color. Instant combination. The Core Ring puts a round green stone at the center of a clean gold band.", priceMin: 1399, priceMax: 1399, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_2c1ffb79-dceb-4a6d-85e6-ad32e06244e5.png", tags: ["ring","silver","core ring","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00011-6", price: "1399.00", inventory: 0 },{ title: "7", sku: "R00011-7", price: "1399.00", inventory: 1 },{ title: "8", sku: "R00011-8", price: "1399.00", inventory: 1 },{ title: "9", sku: "R00011-9", price: "1399.00", inventory: 1 }] } },
  { id: "gid://shopify/Product/12322953920830", handle: "emerald-cut-ring", title: "Emerald Cut Ring", description: "Sharp. Defined. Quietly confident. The Emerald Cut Ring centers a rectangular green stone on a gold band.", priceMin: 1499, priceMax: 1499, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_62fd840f-f2dd-436c-b0db-eb68cda1b593.png", tags: ["ring","silver","emerald cut","handmade","gift"], available: true, rawJson: { productType: "Ring", variants: [{ title: "6", sku: "R00012-6", price: "1499.00", inventory: 3 },{ title: "7", sku: "R00012-7", price: "1499.00", inventory: 5 },{ title: "8", sku: "R00012-8", price: "1499.00", inventory: 5 },{ title: "9", sku: "R00012-9", price: "1499.00", inventory: 5 }] } },
  { id: "gid://shopify/Product/12367494676798", handle: "wave-set", title: "Wave Set", description: "Two pieces. One aesthetic. Worn together, they just make sense. The Wave Set pairs the Wave Ring and the Wave Cuff.", priceMin: 3799, priceMax: 3799, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/2048_2048.png", tags: ["set","ring","cuff","silver","wave","bundle","handmade","gift"], available: true, rawJson: { productType: "Set", variants: [{ title: "6", price: "3799.00", inventory: 0 },{ title: "7", price: "3799.00", inventory: 0 },{ title: "8", price: "3799.00", inventory: 0 },{ title: "9", price: "3799.00", inventory: 0 }] } },
  { id: "gid://shopify/Product/12399918514494", handle: "stack-pack-ridge-ring-dotted-ring-mini-band-ring", title: "Stack Pack — Ridge Ring, Dotted Ring & Mini Band Ring", description: "Three rings. One complete stack. Designed to be worn together.", priceMin: 4299, priceMax: 4299, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_68484433-982f-4ec7-9869-c22c1108e213.png", tags: ["set","ring","silver","bundle","handmade"], available: true, rawJson: { productType: "Set", variants: [{ title: "6", price: "4299.00", inventory: 0 },{ title: "7", price: "4299.00", inventory: 0 },{ title: "8", price: "4299.00", inventory: 0 }] } },
  { id: "gid://shopify/Product/12399918612798", handle: "stone-collection-mosaic-ring-core-ring-trio-stone-ring", title: "Stone Collection — Mosaic Ring, Core Ring & Trio Stone Ring", description: "Three stone rings. One collection. Worn together, they tell a story.", priceMin: 4699, priceMax: 4699, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_2c1ffb79-dceb-4a6d-85e6-ad32e06244e5.png", tags: ["set","ring","silver","bundle","handmade"], available: true, rawJson: { productType: "Set", variants: [{ title: "6", price: "4699.00", inventory: 0 },{ title: "7", price: "4699.00", inventory: 0 },{ title: "8", price: "4699.00", inventory: 0 }] } },
  { id: "gid://shopify/Product/12400524984638", handle: "the-statement-3-dotted-ring-ridge-ring-signet-ring", title: "The Statement 3 — Dotted Ring, Ridge Ring & Signet Ring", description: "Three rings. One image. The exact stack from our editorial shoot.", priceMin: 5299, priceMax: 5299, imageUrl: "https://cdn.shopify.com/s/files/1/0978/9213/9326/files/1_58eec111-d783-4007-90e5-ba6f07f42b5d.png", tags: ["set","ring","silver","bundle","handmade"], available: true, rawJson: { productType: "Set", variants: [{ title: "6", price: "5299.00", inventory: 0 },{ title: "7", price: "5299.00", inventory: 0 },{ title: "8", price: "5299.00", inventory: 0 }] } },
];

const orders = [
  { id: "gid://shopify/Order/6932395360574", orderNumber: "#1023", customerEmail: null, customerPhone: null, totalPrice: 1679, currency: "EGP", status: "PENDING / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-22T01:53:42Z"), customerName: "Tahany Ahmed" },
  { id: "gid://shopify/Order/6919817625918", orderNumber: "#1022", customerEmail: null, customerPhone: null, totalPrice: 1979, currency: "EGP", status: "PENDING / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-16T15:26:41Z"), customerName: "LAYLA MEDHAT MOHAMED" },
  { id: "gid://shopify/Order/6914842886462", orderNumber: "#1021", customerEmail: null, customerPhone: null, totalPrice: 1479, currency: "EGP", status: "PENDING / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-13T19:31:48Z"), customerName: "Haneen Mohamed" },
  { id: "gid://shopify/Order/6914249851198", orderNumber: "#1020", customerEmail: null, customerPhone: null, totalPrice: 979, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-13T14:29:05Z"), customerName: "Dina Akmal" },
  { id: "gid://shopify/Order/6908978987326", orderNumber: "#1019", customerEmail: null, customerPhone: null, totalPrice: 1579, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-10T00:13:55Z"), customerName: "Sara Fouad" },
  { id: "gid://shopify/Order/6906524860734", orderNumber: "#1018", customerEmail: null, customerPhone: null, totalPrice: 1999, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 2 }, createdAt: new Date("2026-05-08T15:13:13Z"), customerName: "Eman Bedier" },
  { id: "gid://shopify/Order/6906508280126", orderNumber: "#1017", customerEmail: null, customerPhone: null, totalPrice: 1999, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-08T15:07:44Z"), customerName: "Rana Mabrook" },
  { id: "gid://shopify/Order/6905519833406", orderNumber: "#1016", customerEmail: null, customerPhone: null, totalPrice: 1579, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-07T22:03:33Z"), customerName: "Dina Gamil" },
  { id: "gid://shopify/Order/6904912445758", orderNumber: "#1015", customerEmail: null, customerPhone: null, totalPrice: 1579, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-07T15:17:03Z"), customerName: "Olivia Werner" },
  { id: "gid://shopify/Order/6897651876158", orderNumber: "#1014", customerEmail: null, customerPhone: null, totalPrice: 2179, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-03T07:16:53Z"), customerName: "Diana Atef" },
  { id: "gid://shopify/Order/6897088201022", orderNumber: "#1013", customerEmail: null, customerPhone: null, totalPrice: 779, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-02T21:46:37Z"), customerName: "Alaa Elmasry" },
  { id: "gid://shopify/Order/6896607232318", orderNumber: "#1012", customerEmail: null, customerPhone: null, totalPrice: 2199, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-02T16:47:06Z"), customerName: "Ahmed Halim" },
  { id: "gid://shopify/Order/6896212541758", orderNumber: "#1011", customerEmail: null, customerPhone: null, totalPrice: 3048.2, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 2 }, createdAt: new Date("2026-05-02T11:50:34Z"), customerName: "Donya Emad" },
  { id: "gid://shopify/Order/6896144449854", orderNumber: "#1010", customerEmail: null, customerPhone: null, totalPrice: 1279, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-02T10:31:55Z"), customerName: "Menna Shazly" },
  { id: "gid://shopify/Order/6894736769342", orderNumber: "#1009", customerEmail: null, customerPhone: null, totalPrice: 1479, currency: "EGP", status: "PARTIALLY_REFUNDED / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-05-01T15:00:02Z"), customerName: "Aliaa Arafa" },
  { id: "gid://shopify/Order/6885655314750", orderNumber: "#1008", customerEmail: null, customerPhone: null, totalPrice: 1479, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-26T10:51:32Z"), customerName: "Salma Fishier" },
  { id: "gid://shopify/Order/6885240996158", orderNumber: "#1007", customerEmail: null, customerPhone: null, totalPrice: 1179, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-26T02:24:17Z"), customerName: "ريهام سليمان" },
  { id: "gid://shopify/Order/6882214674750", orderNumber: "#1006", customerEmail: null, customerPhone: null, totalPrice: 3048.2, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 2 }, createdAt: new Date("2026-04-24T05:45:08Z"), customerName: "NOURA KESHK" },
  { id: "gid://shopify/Order/6881364672830", orderNumber: "#1005", customerEmail: null, customerPhone: null, totalPrice: 1479, currency: "EGP", status: "VOIDED / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-23T16:32:48Z"), customerName: "Rana ABDELBARY" },
  { id: "gid://shopify/Order/6881143128382", orderNumber: "#1004", customerEmail: null, customerPhone: null, totalPrice: 1079, currency: "EGP", status: "PAID / FULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-23T13:57:39Z"), customerName: "marway elsayed" },
  { id: "gid://shopify/Order/6869296546110", orderNumber: "#1003", customerEmail: null, customerPhone: null, totalPrice: 3479, currency: "EGP", status: "VOIDED / UNFULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-16T00:19:10Z"), customerName: "Mostafa Mahmoud" },
  { id: "gid://shopify/Order/6869289697598", orderNumber: "#1002", customerEmail: null, customerPhone: null, totalPrice: 3479, currency: "EGP", status: "VOIDED / UNFULFILLED", lineItemsJson: { count: 1 }, createdAt: new Date("2026-04-16T00:11:55Z"), customerName: "Mostafa Mahmoud" },
  { id: "gid://shopify/Order/6869201289534", orderNumber: "#1001", customerEmail: null, customerPhone: null, totalPrice: 7677, currency: "EGP", status: "VOIDED / UNFULFILLED", lineItemsJson: { count: 3 }, createdAt: new Date("2026-04-15T22:42:16Z"), customerName: "Radwa Elbarbary" },
];

async function main() {
  console.log("Seeding products...");
  for (const p of products) {
    await db.shopifyProductCache.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        handle: p.handle,
        title: p.title,
        description: p.description,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        currency: "EGP",
        imageUrl: p.imageUrl,
        tags: p.tags,
        available: p.available,
        rawJson: p.rawJson,
      },
      update: {
        title: p.title,
        description: p.description,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        imageUrl: p.imageUrl,
        tags: p.tags,
        available: p.available,
        rawJson: p.rawJson,
        syncedAt: new Date(),
      },
    });
  }
  console.log(`✓ Seeded ${products.length} products`);

  console.log("Seeding orders...");
  for (const o of orders) {
    await db.shopifyOrderCache.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        orderNumber: o.orderNumber,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        totalPrice: o.totalPrice,
        currency: o.currency,
        status: o.status,
        lineItemsJson: o.lineItemsJson,
        createdAt: o.createdAt,
      },
      update: {
        status: o.status,
        totalPrice: o.totalPrice,
        syncedAt: new Date(),
      },
    });
  }
  console.log(`✓ Seeded ${orders.length} orders`);

  console.log("Creating default AI config...");
  const existing = await db.aiConfig.findFirst();
  if (!existing) {
    await db.aiConfig.create({
      data: {
        systemPrompt: "You are Rania, the RB Jewelry assistant. RB Jewelry is an Egyptian handmade sterling silver jewelry brand based in Cairo. You help customers with product questions, sizing, and orders. Be warm, concise, and helpful. Respond in the same language the customer uses (Arabic or English).",
        autoReplyEnabled: false,
        platforms: [Platform.INSTAGRAM_DM, Platform.WHATSAPP],
      },
    });
    console.log("✓ Created default AI config");
  } else {
    console.log("✓ AI config already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
