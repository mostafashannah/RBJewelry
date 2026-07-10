"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Search } from "lucide-react";

// ─── Shared types & helpers ─────────────────────────────────────────────────

const CATEGORIES = ["Ring", "Necklace", "Bracelet", "Earrings", "Anklet", "Set", "Other"];
const MATERIALS = ["Silver 925", "Gold 18k Plated", "Other"];
const COLORS_LIST = ["Silver", "Gold", "Rose Gold", "Black", "White", "Blue", "Red", "Green", "Pink", "Purple", "Mixed"];
const RING_SIZES = ["5", "6", "7", "8", "9", "10", "OS"];
const SIZE_CATS = ["Ring", "Bracelet", "Anklet"];
const CAT_PREFIX: Record<string, string> = {
  Ring: "R", Earrings: "E", Necklace: "N", Bracelet: "B", Set: "S", Anklet: "A", Other: "O",
};
const COLOR_CODES = [
  { code: "SL", label: "Silver", display: "Silver" },
  { code: "GD", label: "Gold", display: "Gold" },
  { code: "G",  label: "Green", display: "Green" },
  { code: "R",  label: "Red",   display: "Red" },
  { code: "B",  label: "Blue",  display: "Blue" },
  { code: "P",  label: "Pink",  display: "Pink" },
  { code: "C",  label: "Clear", display: "White" },
  { code: "RG", label: "Rose Gold", display: "Rose Gold" },
  { code: "BK", label: "Black", display: "Black" },
];

function parseProductTitle(title: string): { baseName: string; embeddedOpt1: string; embeddedOpt2: string } {
  const isSz = (s: string) => /^\d+$/.test(s.trim()) || /^(OS|One Size|XS|S|M|L|XL)$/i.test(s.trim());
  let opt1 = "", opt2 = "", t = title;
  const pm = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (pm) {
    t = pm[1].trim();
    const paren = pm[2].trim();
    const parts = paren.split(/\s*\/\s*/);
    if (parts.length >= 2) {
      if (isSz(parts[1])) { opt1 = parts[1].trim(); opt2 = parts[0].trim(); }
      else if (isSz(parts[0])) { opt1 = parts[0].trim(); opt2 = parts[1].trim(); }
      else { opt1 = parts[0].trim(); opt2 = parts[1].trim(); }
    } else if (isSz(paren)) { opt1 = paren; }
    else { opt2 = paren; }
    const di = t.indexOf(" — ");
    if (di > 0) t = t.slice(0, di).trim();
  }
  return { baseName: t.trim() || title.trim(), embeddedOpt1: opt1, embeddedOpt2: opt2 };
}

function parseVariantTitle(vt: string, fo1: string, fo2: string): { opt1: string; opt2: string } {
  const isSz = (s: string) => /^\d+$/.test(s.trim()) || /^(OS|One Size|XS|S|M|L|XL)$/i.test(s.trim());
  const parts = vt.split(/\s*\/\s*/);
  if (parts.length >= 2) {
    if (isSz(parts[1])) return { opt1: parts[1].trim(), opt2: parts[0].trim() };
    if (isSz(parts[0])) return { opt1: parts[0].trim(), opt2: parts[1].trim() };
    return { opt1: parts[0].trim(), opt2: parts[1].trim() };
  }
  if (isSz(parts[0])) return { opt1: parts[0].trim(), opt2: fo2 };
  return { opt1: fo1, opt2: parts[0].trim() };
}

type AddMode = "existing" | "new-color" | "new";
type ShopifyVariantEntry = { title: string; sku: string; price: number; qty: number; weightG: number };
type ShopifyProductEntry = { id: string; title: string; imageUrl: string | null; variants: ShopifyVariantEntry[]; defaultSku: string; defaultPrice: number; defaultWeightG: number };
type ShopifyGroupOption = { opt1: string; opt2: string; sku: string; price: number; weightG: number };
type ShopifyGroup = { baseName: string; imageUrl: string | null; options: ShopifyGroupOption[] };
type SkuMeta = {
  byCategory: Record<string, Array<{ id: string; name: string; sku: string | null; priceEGP: number | null }>>;
  nextNumbers: Record<string, number>;
  shopifyProducts: ShopifyProductEntry[];
};
type CostSettings = {
  metal: { markupPct: number };
  manufacturing: { mode: "percentage" | "per_gram"; pct: number; perGram: number };
  plating: Record<string, number>;
  packaging: { fixed: number };
  transportation: { fixed: number };
  usdEgpRate: number;
};
type SilverData = {
  spot: { pricePerGramUSD: number } | null;
  usdEgpRate: number | null;
};

const DEFAULT_SETTINGS: CostSettings = {
  metal: { markupPct: 10 },
  manufacturing: { mode: "percentage", pct: 10, perGram: 5 },
  plating: { Ring: 15, Earrings: 20, Necklace: 25, Bracelet: 20, Anklet: 15, Set: 30, Other: 10 },
  packaging: { fixed: 75 },
  transportation: { fixed: 0 },
  usdEgpRate: 50,
};

type ItemForm = {
  name: string; sku: string; category: string; material: string;
  weightG: string; colors: string[]; size: string; quantity: string;
  metalCostEGP: string; platingCostEGP: string; stoneCostEGP: string;
  manufacturingCostEGP: string; transportationCostEGP: string; packagingCostEGP: string;
  priceEGP: string; orderNo: string; notes: string;
};

const emptyForm = (): ItemForm => ({
  name: "", sku: "", category: "Ring", material: "Silver 925",
  weightG: "", colors: [], size: "", quantity: "1",
  metalCostEGP: "", platingCostEGP: "", stoneCostEGP: "",
  manufacturingCostEGP: "", transportationCostEGP: "", packagingCostEGP: "",
  priceEGP: "", orderNo: "", notes: "",
});

type RowStatus = { ok: boolean; message: string } | null;

function newId() { return Math.random().toString(36).slice(2, 9); }

// Initial values injected when a card is created from an order import
interface CardInitial {
  orderNo: string;
  name: string;
  sku: string | null;
  quantity: number;
  priceEGP: string;
  baseName: string;   // matched shopifyGroups key
  opt1: string;
  opt2: string;
  imageUrl: string | null;
}

// ─── Item Card ───────────────────────────────────────────────────────────────

interface CardProps {
  index: number;
  shopifyGroups: Map<string, ShopifyGroup>;
  skuMeta: SkuMeta | null;
  silver: SilverData | null;
  settings: CostSettings;
  status: RowStatus;
  initial?: CardInitial;
  onRemove: () => void;
  onFormChange: (f: ItemForm, photoUrl: string | null) => void;
}

function ItemCard({ index, shopifyGroups, skuMeta, silver, settings, status, initial, onRemove, onFormChange }: CardProps) {
  const [addMode, setAddMode] = useState<AddMode>(initial ? "existing" : "existing");
  const [form, setForm] = useState<ItemForm>(() => initial
    ? { ...emptyForm(), name: initial.name, sku: initial.sku ?? "", quantity: String(initial.quantity), priceEGP: initial.priceEGP, orderNo: initial.orderNo }
    : emptyForm());
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [selectedBaseName, setSelectedBaseName] = useState(initial?.baseName ?? "");
  const [selectedOpt1, setSelectedOpt1] = useState(initial?.opt1 ?? "");
  const [selectedOpt2, setSelectedOpt2] = useState(initial?.opt2 ?? "");
  const [selectedColorCode, setSelectedColorCode] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; sku: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const weightEditedRef = useRef(false);

  const updateForm = (patch: Partial<ItemForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const toggleColor = (color: string) =>
    setForm((f) => ({
      ...f,
      colors: f.colors.includes(color) ? f.colors.filter((c) => c !== color) : [...f.colors, color],
    }));

  // Notify parent on changes
  useEffect(() => { onFormChange(form, photoUrl); }, [form, photoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // SKU + name auto-generation
  useEffect(() => {
    if (addMode === "existing" && selectedBaseName) {
      const group = shopifyGroups.get(selectedBaseName);
      if (group) {
        const matched = group.options.find((o) =>
          (!selectedOpt1 || o.opt1 === selectedOpt1) && (!selectedOpt2 || o.opt2 === selectedOpt2)
        ) ?? group.options[0] ?? null;
        setForm((f) => ({
          ...f,
          name: selectedBaseName,
          sku: matched?.sku ?? f.sku,
          priceEGP: matched?.price ? String(matched.price) : f.priceEGP,
          weightG: (!weightEditedRef.current && matched?.weightG) ? String(matched.weightG) : f.weightG,
          colors: selectedOpt2 ? [selectedOpt2] : (f.colors.length ? f.colors : []),
          size: selectedOpt1 || f.size,
        }));
        setPhotoUrl((prev) => prev ?? group.imageUrl ?? null);
      }
      return;
    }
    if (addMode === "new-color" && selectedProduct) {
      const baseNum = (selectedProduct.sku ?? "").split("-")[0];
      let sku = baseNum;
      if (selectedColorCode) sku += `-${selectedColorCode}`;
      if (selectedSize) sku += `-${selectedSize}`;
      const colorLabel = COLOR_CODES.find((c) => c.code === selectedColorCode)?.display ?? "";
      setForm((f) => ({
        ...f,
        name: selectedProduct.name + (colorLabel ? ` (${colorLabel})` : ""),
        sku, size: selectedSize,
        colors: colorLabel ? [colorLabel] : [],
      }));
      return;
    }
    if (addMode === "new") {
      const prefix = CAT_PREFIX[form.category] ?? "O";
      const num = skuMeta?.nextNumbers[prefix] ?? 1;
      let sku = `${prefix}${String(num + index).padStart(5, "0")}`;
      if (selectedColorCode) sku += `-${selectedColorCode}`;
      if (selectedSize) sku += `-${selectedSize}`;
      const colorLabel = COLOR_CODES.find((c) => c.code === selectedColorCode)?.display ?? "";
      setForm((f) => ({ ...f, sku, size: selectedSize, colors: colorLabel ? [colorLabel] : [] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode, selectedBaseName, selectedOpt1, selectedOpt2, selectedProduct, selectedColorCode, selectedSize, form.category, skuMeta, index]);

  // Auto-fill cost breakdown
  useEffect(() => {
    const w = parseFloat(form.weightG);
    if (!w || w <= 0 || !silver?.spot) return;
    const egpRate = silver.usdEgpRate ?? settings.usdEgpRate;
    const silverPerGramEGP = silver.spot.pricePerGramUSD * egpRate;
    const metalCost = Math.round(w * 0.925 * silverPerGramEGP * (1 + settings.metal.markupPct / 100));
    const mfgCost = settings.manufacturing.mode === "percentage"
      ? Math.round(metalCost * settings.manufacturing.pct / 100)
      : Math.round(w * settings.manufacturing.perGram);
    const platingCost = settings.plating[form.category] ?? 0;
    const packagingCost = settings.packaging.fixed;
    const transportationCost = settings.transportation.fixed;
    setForm((f) => ({
      ...f,
      metalCostEGP: String(metalCost),
      manufacturingCostEGP: String(mfgCost),
      platingCostEGP: String(platingCost),
      packagingCostEGP: String(packagingCost),
      transportationCostEGP: String(transportationCost),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.weightG, form.category, settings, silver]);

  const baseNames = Array.from(shopifyGroups.keys()).sort();
  const currentGroup = selectedBaseName ? shopifyGroups.get(selectedBaseName) : null;
  const allOpt1s = currentGroup
    ? Array.from(new Set(currentGroup.options.map((o) => o.opt1).filter(Boolean)))
        .sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b))
    : [];
  const allOpt2s = currentGroup
    ? Array.from(new Set(currentGroup.options.map((o) => o.opt2).filter(Boolean))).sort()
    : [];

  const borderColor = status?.ok ? "border-emerald-300 bg-emerald-50/40"
    : status ? "border-red-300 bg-red-50/40"
    : "border-zinc-200 bg-white";

  return (
    <div className={`rounded-2xl border ${borderColor} overflow-hidden shadow-sm`}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
        <span className="text-xs font-semibold text-zinc-400 w-5">#{index + 1}</span>
        <div className="flex gap-1 flex-1">
          {(["existing", "new-color", "new"] as AddMode[]).map((m) => (
            <button key={m} type="button"
              onClick={() => { setAddMode(m); setSelectedBaseName(""); setSelectedOpt1(""); setSelectedOpt2(""); setSelectedProduct(null); setSelectedColorCode(""); setSelectedSize(""); setPhotoUrl(null); setForm(emptyForm()); weightEditedRef.current = false; }}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${addMode === m ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
              {m === "existing" ? "Existing" : m === "new-color" ? "New Color" : "New"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {status?.ok && <CheckCircle className="w-4 h-4 text-emerald-500" />}
          {status && !status.ok && <span title={status.message}><AlertCircle className="w-4 h-4 text-red-400" /></span>}
          <button onClick={() => setCollapsed((c) => !c)} className="text-zinc-400 hover:text-zinc-600 p-0.5">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button onClick={onRemove} className="text-zinc-300 hover:text-red-400 p-0.5">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Photo + product selector */}
          <div className="flex gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt="Product" className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-100" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-zinc-100 shrink-0 flex items-center justify-center text-zinc-300 text-xs">No photo</div>
            )}
            <div className="flex-1 space-y-2">
              {addMode === "existing" && (
                <select value={selectedBaseName} onChange={(e) => { setSelectedBaseName(e.target.value); setSelectedOpt1(""); setSelectedOpt2(""); setPhotoUrl(null); weightEditedRef.current = false; }}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400">
                  <option value="">— Pick a product —</option>
                  {baseNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              {addMode === "new-color" && (
                <select value={selectedProduct?.id ?? ""} onChange={(e) => {
                  const p = skuMeta?.byCategory[form.category]?.find((x) => x.id === e.target.value) ?? null;
                  setSelectedProduct(p ? { id: p.id, name: p.name, sku: p.sku } : null);
                }}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400">
                  <option value="">— Pick base product —</option>
                  {(skuMeta?.byCategory[form.category] ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</option>
                  ))}
                </select>
              )}
              {addMode === "new" && (
                <select value={form.category} onChange={(e) => updateForm({ category: e.target.value })}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              {/* SKU display */}
              {form.sku && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 text-xs">#</span>
                  <input value={form.sku} onChange={(e) => updateForm({ sku: e.target.value })}
                    className="flex-1 text-xs border border-zinc-100 rounded-lg px-2 py-1 text-zinc-600 focus:outline-none focus:border-zinc-300" />
                </div>
              )}
            </div>
          </div>

          {/* Opt1 (size) chips — only actual variants, no "Any" */}
          {addMode === "existing" && allOpt1s.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Size</label>
              <div className="flex flex-wrap gap-1.5">
                {allOpt1s.map((v) => (
                  <button key={v} type="button" onClick={() => setSelectedOpt1(selectedOpt1 === v ? "" : v)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedOpt1 === v ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opt2 (color) chips — only actual variants, no "Any" */}
          {addMode === "existing" && allOpt2s.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {allOpt2s.map((v) => (
                  <button key={v} type="button" onClick={() => setSelectedOpt2(selectedOpt2 === v ? "" : v)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedOpt2 === v ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color code chips (new / new-color) */}
          {(addMode === "new-color" || addMode === "new") && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelectedColorCode("")}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedColorCode === "" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-400"}`}>
                  None
                </button>
                {COLOR_CODES.map(({ code, label }) => (
                  <button key={code} type="button" onClick={() => setSelectedColorCode(code)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedColorCode === code ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size chips (new / new-color for ring-type categories) */}
          {(addMode === "new-color" || addMode === "new") && SIZE_CATS.includes(form.category) && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Size</label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelectedSize("")}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedSize === "" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-400"}`}>
                  None
                </button>
                {RING_SIZES.map((s) => (
                  <button key={s} type="button" onClick={() => setSelectedSize(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedSize === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name (new mode) */}
          {addMode === "new" && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Item Name *</label>
              <input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="e.g. Twisted Band Ring"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
            </div>
          )}

          {/* Colors (stored) — hidden in existing mode; colors come from opt2 variant selection */}
          {addMode !== "existing" && (
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Colors (stored)</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS_LIST.map((color) => (
                  <button key={color} type="button" onClick={() => toggleColor(color)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.colors.includes(color) ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Weight / Qty / Material */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Weight (g) *</label>
              <input type="number" step="0.1" min="0" value={form.weightG}
                onChange={(e) => { weightEditedRef.current = true; updateForm({ weightG: e.target.value }); }}
                placeholder="e.g. 4.5"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Qty</label>
              <input type="number" min="1" value={form.quantity} onChange={(e) => updateForm({ quantity: e.target.value })}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Material</label>
              <select value={form.material} onChange={(e) => updateForm({ material: e.target.value })}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400">
                {MATERIALS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div>
            <p className="text-xs font-semibold text-zinc-700 mb-2">Cost Breakdown (EGP)
              {silver?.spot && <span className="text-emerald-600 font-normal ml-2 text-[10px]">⚡ auto-filled</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "metalCostEGP", label: "Metal (925)" },
                { key: "platingCostEGP", label: "Plating" },
                { key: "stoneCostEGP", label: "Stone" },
                { key: "manufacturingCostEGP", label: "Manufacturing" },
                { key: "transportationCostEGP", label: "Transportation" },
                { key: "packagingCostEGP", label: "Packaging" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] text-zinc-400 block mb-1">{label}</label>
                  <input type="number" min="0" placeholder="0"
                    value={form[key as keyof ItemForm] as string}
                    onChange={(e) => updateForm({ [key]: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Price + Order No */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Price (EGP)</label>
              <input type="number" min="0" value={form.priceEGP} onChange={(e) => updateForm({ priceEGP: e.target.value })} placeholder="0"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Order No</label>
              <input value={form.orderNo} onChange={(e) => updateForm({ orderNo: e.target.value })} placeholder="auto-marks sold"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-zinc-500 font-medium block mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} placeholder="Optional notes"
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type CardData = { id: string; form: ItemForm; photoUrl: string | null };
type RowStatus2 = { ok: boolean; message: string } | null;

export default function BulkAddPage() {
  const router = useRouter();
  const [cards, setCards] = useState<{ id: string; initial?: CardInitial }[]>([{ id: newId() }, { id: newId() }, { id: newId() }]);
  const [cardData, setCardData] = useState<Record<string, CardData>>({});
  const [statuses, setStatuses] = useState<Record<string, RowStatus2>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [skuMeta, setSkuMeta] = useState<SkuMeta | null>(null);
  const [silver, setSilver] = useState<SilverData | null>(null);
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_SETTINGS);

  // Order import
  const [orderInput, setOrderInput] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  const shopifyGroups = useMemo<Map<string, ShopifyGroup>>(() => {
    const map = new Map<string, ShopifyGroup>();
    for (const p of (skuMeta?.shopifyProducts ?? [])) {
      const { baseName, embeddedOpt1, embeddedOpt2 } = parseProductTitle(p.title);
      if (!map.has(baseName)) map.set(baseName, { baseName, imageUrl: p.imageUrl, options: [] });
      const g = map.get(baseName)!;
      if (!g.imageUrl && p.imageUrl) g.imageUrl = p.imageUrl;
      const realVariants = p.variants.filter((v) => v.title && v.title !== "Default Title");
      if (realVariants.length > 0) {
        for (const v of realVariants) {
          const { opt1, opt2 } = parseVariantTitle(v.title, embeddedOpt1, embeddedOpt2);
          if (!g.options.some((o) => o.opt1 === opt1 && o.opt2 === opt2))
            g.options.push({ opt1, opt2, sku: v.sku, price: v.price, weightG: v.weightG });
        }
      } else {
        if (!g.options.some((o) => o.opt1 === embeddedOpt1 && o.opt2 === embeddedOpt2))
          g.options.push({ opt1: embeddedOpt1, opt2: embeddedOpt2, sku: p.defaultSku, price: p.defaultPrice, weightG: p.defaultWeightG });
      }
    }
    return map;
  }, [skuMeta]);

  // Reverse map: SKU → { baseName, opt1, opt2, imageUrl, price }
  const skuToProduct = useMemo(() => {
    const map = new Map<string, { baseName: string; opt1: string; opt2: string; imageUrl: string | null; price: number }>();
    for (const [baseName, group] of Array.from(shopifyGroups)) {
      for (const opt of group.options) {
        if (opt.sku) map.set(opt.sku, { baseName, opt1: opt.opt1, opt2: opt.opt2, imageUrl: group.imageUrl, price: opt.price });
      }
    }
    return map;
  }, [shopifyGroups]);

  useEffect(() => {
    fetch("/api/inventory/sku-meta").then((r) => r.json()).then(setSkuMeta).catch(() => null);
    fetch("/api/inventory/silver-value").then((r) => r.json()).then(setSilver).catch(() => null);
    fetch("/api/inventory/settings").then((r) => r.json()).then(setSettings).catch(() => null);
  }, []);

  async function importFromOrder() {
    const q = orderInput.replace(/^#/, "").trim();
    if (!q) return;
    setOrderLoading(true);
    setOrderError("");
    try {
      const res = await fetch(`/api/inventory/order-items?orderNo=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) { setOrderError(data.error ?? "Order not found"); return; }

      type OItem = { title: string; sku: string | null; quantity: number; variantTitle: string | null };
      const newCards = (data.items as OItem[]).map((item) => {
        // Match by SKU first, then by title
        const bysku = item.sku ? skuToProduct.get(item.sku) : null;
        const byTitle = bysku ? null : (() => {
          const tl = item.title.toLowerCase();
          for (const [baseName, group] of Array.from(shopifyGroups)) {
            if (baseName.toLowerCase().includes(tl) || tl.includes(baseName.toLowerCase())) {
              const opt = group.options[0];
              return { baseName, opt1: opt?.opt1 ?? "", opt2: opt?.opt2 ?? "", imageUrl: group.imageUrl, price: opt?.price ?? 0 };
            }
          }
          return null;
        })();
        const match = bysku ?? byTitle;
        return {
          id: newId(),
          initial: {
            orderNo: data.orderNo,
            name: match?.baseName ?? item.title,
            sku: item.sku,
            quantity: item.quantity,
            priceEGP: match ? String(match.price) : "",
            baseName: match?.baseName ?? "",
            opt1: match?.opt1 ?? "",
            opt2: match?.opt2 ?? "",
            imageUrl: match?.imageUrl ?? null,
          } as CardInitial,
        };
      });

      // Replace empty cards + append new ones
      setCards((cs) => [...cs.filter((c) => !isEmptyCard(c.id)), ...newCards]);
      setOrderInput("");
    } catch {
      setOrderError("Failed to fetch order");
    } finally {
      setOrderLoading(false);
    }
  }

  const handleFormChange = useCallback((id: string, form: ItemForm, photoUrl: string | null) => {
    setCardData((prev) => ({ ...prev, [id]: { id, form, photoUrl } }));
  }, []);

  function addCard() {
    setCards((cs) => [...cs, { id: newId() }]);
  }

  function removeCard(id: string) {
    setCards((cs) => cs.filter((c) => c.id !== id));
    setCardData((d) => { const n = { ...d }; delete n[id]; return n; });
    setStatuses((s) => { const n = { ...s }; delete n[id]; return n; });
  }

  function isEmptyCard(id: string) {
    const f = cardData[id]?.form;
    return !f || (!f.name.trim() && !f.weightG.trim());
  }

  async function handleSubmit() {
    const active = cards.filter((c) => !isEmptyCard(c.id));
    if (!active.length) return;
    setSubmitting(true);
    setDone(false);
    const newStatuses: Record<string, RowStatus2> = {};

    await Promise.all(
      active.map(async ({ id }) => {
        const data = cardData[id];
        if (!data) { newStatuses[id] = { ok: false, message: "No data" }; return; }
        const { form, photoUrl } = data;
        if (!form.name.trim()) { newStatuses[id] = { ok: false, message: "Name required" }; return; }
        if (!form.weightG || parseFloat(form.weightG) <= 0) { newStatuses[id] = { ok: false, message: "Weight required" }; return; }

        const subCosts = [form.metalCostEGP, form.platingCostEGP, form.stoneCostEGP,
          form.manufacturingCostEGP, form.transportationCostEGP, form.packagingCostEGP];
        const subTotal = subCosts.reduce((s, v) => s + (v ? parseFloat(v) : 0), 0);
        const costEGP = subTotal > 0 ? String(subTotal) : "";

        try {
          const res = await fetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name.trim(),
              sku: form.sku.trim() || null,
              category: form.category,
              material: form.material,
              size: form.size || null,
              weightG: form.weightG,
              colors: form.colors,
              quantity: form.quantity || "1",
              metalCostEGP: form.metalCostEGP || null,
              platingCostEGP: form.platingCostEGP || null,
              stoneCostEGP: form.stoneCostEGP || null,
              manufacturingCostEGP: form.manufacturingCostEGP || null,
              transportationCostEGP: form.transportationCostEGP || null,
              packagingCostEGP: form.packagingCostEGP || null,
              costEGP: costEGP || null,
              priceEGP: form.priceEGP || null,
              photoUrl: photoUrl || null,
              orderNo: form.orderNo || null,
              notes: form.notes || null,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            newStatuses[id] = { ok: false, message: err.error ?? "Failed" };
          } else {
            newStatuses[id] = { ok: true, message: "Added" };
          }
        } catch {
          newStatuses[id] = { ok: false, message: "Network error" };
        }
      })
    );

    setStatuses(newStatuses);
    setSubmitting(false);
    setDone(true);
  }

  function clearSuccess() {
    const successIds = new Set(Object.entries(statuses).filter(([, s]) => s?.ok).map(([id]) => id));
    setCards((cs) => cs.filter((c) => !successIds.has(c.id)));
    setCardData((d) => { const n = { ...d }; successIds.forEach((id) => delete n[id]); return n; });
    setStatuses((s) => { const n = { ...s }; successIds.forEach((id) => delete n[id]); return n; });
    setDone(false);
  }

  const activeCount = cards.filter((c) => !isEmptyCard(c.id)).length;
  const successCount = Object.values(statuses).filter((s) => s?.ok).length;
  const errorCount = Object.values(statuses).filter((s) => s && !s.ok).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/inventory")}
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" />Inventory
            </button>
            <span className="text-zinc-300">/</span>
            <h1 className="text-lg font-semibold text-zinc-900">Bulk Add</h1>
          </div>
          <div className="flex items-center gap-2">
            {done && successCount > 0 && (
              <button onClick={clearSuccess}
                className="text-sm text-zinc-500 border border-zinc-200 rounded-xl px-3 py-2 hover:text-zinc-800 transition-colors">
                Clear {successCount} added
              </button>
            )}
            <button onClick={handleSubmit} disabled={submitting || activeCount === 0}
              className="flex items-center gap-2 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Adding…" : `Add ${activeCount || ""} Item${activeCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {/* Import from Order */}
        <div className="mb-4 bg-white border border-zinc-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-zinc-700 mb-2">Import from Order</p>
          <div className="flex gap-2">
            <input
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && importFromOrder()}
              placeholder="Order # e.g. 1234"
              className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400"
            />
            <button
              onClick={importFromOrder}
              disabled={orderLoading || !orderInput.trim()}
              className="flex items-center gap-1.5 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {orderLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Load Order
            </button>
          </div>
          {orderError && <p className="text-xs text-red-500 mt-1.5">{orderError}</p>}
          <p className="text-[10px] text-zinc-400 mt-1.5">Enter an order number to pre-fill cards with its items — then complete the missing fields.</p>
        </div>

        {/* Result banner */}
        {done && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${errorCount === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {errorCount === 0
              ? <><CheckCircle className="w-4 h-4 shrink-0" />{successCount} item{successCount !== 1 ? "s" : ""} added.</>
              : <><AlertCircle className="w-4 h-4 shrink-0" />{successCount} added, {errorCount} failed.</>}
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {cards.map((c, i) => (
            <ItemCard
              key={c.id}
              index={i}
              shopifyGroups={shopifyGroups}
              skuMeta={skuMeta}
              silver={silver}
              settings={settings}
              status={statuses[c.id] ?? null}
              initial={c.initial}
              onRemove={() => removeCard(c.id)}
              onFormChange={(form, photoUrl) => handleFormChange(c.id, form, photoUrl)}
            />
          ))}
        </div>

        <button onClick={addCard}
          className="mt-4 flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 text-sm transition-colors">
          <Plus className="w-4 h-4" />Add another item
        </button>
      </div>
    </div>
  );
}
