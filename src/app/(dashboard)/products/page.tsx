export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import Image from "next/image";

export default async function ProductsPage() {
  const products = await db.shopifyProductCache.findMany({
    orderBy: { syncedAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <p className="text-sm text-zinc-500 mt-1">{products.length} products from Shopify</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-sm">No products yet. Run the seed from Settings to load your catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const raw = p.rawJson as { productType?: string; variants?: { price?: string; inventory?: number }[] };
            const price = raw?.variants?.[0]?.price ?? "—";
            const inStock = raw?.variants?.some((v) => (v.inventory ?? 0) > 0) ?? false;
            return (
              <div key={p.id} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                {p.imageUrl && (
                  <div className="aspect-square relative bg-zinc-50">
                    <Image
                      src={p.imageUrl}
                      alt={p.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                      unoptimized
                    />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {typeof price === "string" ? parseFloat(price).toLocaleString() : price} EGP
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                        inStock ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {inStock ? "In Stock" : "Out of Stock"}
                    </span>
                    {raw?.productType && (
                      <span className="text-[10px] text-zinc-400">{raw.productType}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
