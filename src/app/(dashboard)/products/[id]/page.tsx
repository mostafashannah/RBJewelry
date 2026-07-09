"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import Image from "next/image";

interface RawVariant {
  id?: number;
  title?: string;
  sku?: string;
  price?: string;
  inventory_quantity?: number;
  image?: { src: string; alt?: string | null } | null;
  selectedOptions?: { name: string; value: string }[];
}

interface RawProduct {
  variants?: RawVariant[];
  images?: { src: string; alt?: string | null }[];
}

interface Product {
  id: string;
  title: string;
  priceMin: number;
  priceMax: number;
  imageUrl: string | null;
  available: boolean;
  rawJson: RawProduct | null;
}

interface ParsedVariant {
  id: number;
  color: string;
  size: string;
  sku: string;
  price: number;
  qty: number;
  imageUrl: string | null;
}

interface ColorGroup {
  color: string;
  imageUrl: string | null;
  variants: ParsedVariant[];
  totalQty: number;
}

function parseVariant(v: RawVariant, productImages: { src: string }[], colorIndex: number): ParsedVariant {
  const title = v.title ?? "Default Title";
  const options = v.selectedOptions;

  let color = "";
  let size = "";

  if (options && options.length > 0) {
    // Use selectedOptions when available (after sync with new query)
    color = options[0]?.value ?? "";
    size = options.slice(1).map((o) => o.value).join(" / ") || "";
  } else if (title !== "Default Title") {
    const parts = title.split(" / ");
    color = parts[0] ?? "";
    size = parts.slice(1).join(" / ") || "";
  }

  // Variant's own image → product image at colorIndex → product main image
  const imageUrl = v.image?.src ?? productImages[colorIndex]?.src ?? productImages[0]?.src ?? null;

  return {
    id: v.id ?? 0,
    color,
    size,
    sku: v.sku ?? "",
    price: parseFloat(v.price ?? "0"),
    qty: v.inventory_quantity ?? 0,
    imageUrl,
  };
}

function groupByColor(variants: ParsedVariant[]): ColorGroup[] {
  const order: string[] = [];
  const map: Record<string, ParsedVariant[]> = {};

  for (const v of variants) {
    const key = v.color || "Default";
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(v);
  }

  return order.map((color, idx) => {
    const vlist = map[color];
    // Find the first variant in this color group that has an image
    const imgVariant = vlist.find((v) => v.imageUrl);
    return {
      color,
      imageUrl: imgVariant?.imageUrl ?? null,
      variants: vlist,
      totalQty: vlist.reduce((s, v) => s + v.qty, 0),
    };
  });
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch(`/api/shopify/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProduct(data);
      })
      .catch(() => setError("Failed to load product"))
      .finally(() => setLoading(false));
  }, [id]);

  const syncAndReload = async () => {
    setSyncing(true);
    await fetch("/api/shopify/sync", { method: "POST" });
    const res = await fetch(`/api/shopify/products/${id}`);
    const data = await res.json();
    if (!data.error) setProduct(data);
    setSyncing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  if (error || !product) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
      <AlertCircle className="w-8 h-8" />
      <p>{error ?? "Product not found"}</p>
      <button onClick={() => router.back()} className="text-sm text-zinc-500 underline">Go back</button>
    </div>
  );

  const raw = product.rawJson;
  const rawVariants: RawVariant[] = raw?.variants ?? [];
  const productImages: { src: string }[] = raw?.images ?? (product.imageUrl ? [{ src: product.imageUrl }] : []);

  const isDefaultOnly = rawVariants.length === 1 && rawVariants[0].title === "Default Title";

  // Track color index for image fallback
  const colorsSeen: string[] = [];
  const parsed: ParsedVariant[] = rawVariants.map((v) => {
    const title = v.title ?? "Default Title";
    let color = "";
    if (v.selectedOptions && v.selectedOptions.length > 0) {
      color = v.selectedOptions[0]?.value ?? "";
    } else if (title !== "Default Title") {
      color = title.split(" / ")[0] ?? "";
    }
    const colorKey = color || "Default";
    if (!colorsSeen.includes(colorKey)) colorsSeen.push(colorKey);
    const colorIndex = colorsSeen.indexOf(colorKey);
    return parseVariant(v, productImages, colorIndex);
  });

  const colorGroups = groupByColor(parsed);
  const totalQty = parsed.reduce((s, v) => s + v.qty, 0);

  const mainPrice = product.priceMin === product.priceMax
    ? `${product.priceMin.toLocaleString()} EGP`
    : `${product.priceMin.toLocaleString()}–${product.priceMax.toLocaleString()} EGP`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-100 transition-colors mt-0.5">
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 leading-tight">{product.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-semibold text-zinc-700">{mainPrice}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              totalQty > 0 || product.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
            }`}>
              {totalQty > 0 ? `${totalQty} in stock` : product.available ? "Available" : "Out of stock"}
            </span>
          </div>
        </div>
        <button onClick={syncAndReload} disabled={syncing}
          className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 disabled:opacity-40">
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* If single default variant */}
      {isDefaultOnly ? (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <div className="w-20 h-20 relative rounded-xl overflow-hidden flex-shrink-0 bg-zinc-50">
                <Image src={product.imageUrl} alt={product.title} fill className="object-cover" sizes="80px" unoptimized />
              </div>
            ) : (
              <div className="w-20 h-20 bg-zinc-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={24} className="text-zinc-300" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-700">{rawVariants[0]?.sku || "No SKU"}</p>
              <p className="text-sm text-zinc-500 mt-1">{mainPrice}</p>
              <p className={`text-sm font-semibold mt-1 ${totalQty > 0 ? "text-emerald-600" : "text-zinc-400"}`}>
                {totalQty} in stock
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Color-grouped variant cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {colorGroups.map((group) => (
            <ColorCard key={group.color} group={group} productImage={product.imageUrl} />
          ))}
        </div>
      )}
    </div>
  );
}

function ColorCard({ group, productImage }: { group: ColorGroup; productImage: string | null }) {
  const imgSrc = group.imageUrl ?? productImage;
  const hasSizes = group.variants.some((v) => v.size);

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Color image */}
      {imgSrc ? (
        <div className="aspect-[4/3] relative bg-zinc-50">
          <Image src={imgSrc} alt={group.color} fill className="object-cover" sizes="400px" unoptimized />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
            <p className="text-sm font-semibold text-white">{group.color}</p>
          </div>
        </div>
      ) : (
        <div className="aspect-[4/3] bg-zinc-50 flex flex-col items-center justify-center gap-2">
          <ShoppingBag size={28} className="text-zinc-200" />
          <p className="text-sm font-medium text-zinc-400">{group.color}</p>
        </div>
      )}

      {/* Stock summary + sizes */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Total stock</span>
          <span className={`text-sm font-semibold ${group.totalQty > 0 ? "text-emerald-600" : "text-zinc-400"}`}>
            {group.totalQty}
          </span>
        </div>

        {hasSizes && (
          <div className="border-t border-zinc-50 pt-2 space-y-1">
            {group.variants.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-600 font-medium truncate">{v.size || "—"}</span>
                  {v.sku && <span className="text-zinc-300 font-mono truncate">{v.sku}</span>}
                </div>
                <span className={`font-semibold shrink-0 ml-2 ${v.qty > 0 ? "text-emerald-600" : "text-zinc-300"}`}>
                  {v.qty}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
