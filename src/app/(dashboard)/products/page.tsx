import { getProducts } from "@/lib/shopify/admin";
import Image from "next/image";

export const revalidate = 60;

export default async function ProductsPage() {
  let products: Awaited<ReturnType<typeof getProducts>>["products"] = [];
  try {
    const data = await getProducts(50);
    products = data.products;
  } catch {
    /* will show empty state */
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <p className="text-sm text-zinc-500 mt-1">{products.length} products in your Shopify store</p>
        </div>
        <form action="/api/shopify/sync" method="POST">
          <button
            type="submit"
            className="text-xs px-3 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Sync to AI
          </button>
        </form>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-sm">No products found. Check your Shopify API credentials.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const price = p.variants[0]?.price ?? "—";
            const inStock = p.variants.some((v) => v.inventory_quantity > 0);
            return (
              <div key={p.id} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                {p.images[0] && (
                  <div className="aspect-square relative bg-zinc-50">
                    <Image
                      src={p.images[0].src}
                      alt={p.images[0].alt ?? p.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{parseFloat(price).toLocaleString()} EGP</p>
                  <span
                    className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1.5 ${
                      inStock ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {inStock ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
