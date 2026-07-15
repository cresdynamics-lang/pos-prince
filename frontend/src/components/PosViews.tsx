"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/auth";
import {
  cacheCatalog,
  cacheShops,
  cacheVariants,
  enqueueSale,
  getCachedShops,
  getCachedVariants,
  isOnline,
  type CheckoutPayload,
} from "@/lib/offline";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useStore } from "@/lib/store-context";
import type { Category } from "@/lib/catalog";

type VariantTile = {
  id: string;
  product: string;
  category: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  price: number;
  stock?: number;
  stores?: { store_id: string; store_name: string; quantity: number }[];
};

type Shop = { id: string; name: string };

const STOCK_EXTERNAL = "__external__";

type CartLine = {
  key: string;
  variant_id: string;
  product: string;
  variant_label: string;
  list_price: number;
  sale_price: number;
  quantity: number;
  inventory_shop_id: string;
  inventory_shop_name: string;
  external_source_shop_name?: string;
  store_stocks: { store_id: string; store_name: string; quantity: number }[];
};

function variantLabel(v: VariantTile) {
  const parts = [v.color && v.color !== "Default" ? v.color : null, v.size ? `Size ${v.size}` : null].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return v.product;
}

export function PosView({ categories }: { categories: Category[] }) {
  const { selectedStoreId } = useStore();
  const { online, pending, syncMsg, clearMsg, refreshPending } = useOfflineSync();
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantTile[]>([]);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sellingStore, setSellingStore] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    cacheCatalog(categories);
  }, [categories]);

  useEffect(() => {
    const cached = getCachedShops<Shop[]>();
    if (cached?.length) {
      setShops(cached);
      const def = selectedStoreId || cached[0]?.id || "";
      if (def) setSellingStore((s) => selectedStoreId || s || def);
    }

    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => {
        const list = d.shops ?? [];
        setShops(list);
        cacheShops(list);
        const def = selectedStoreId || list[0]?.id || "";
        if (def) setSellingStore((s) => selectedStoreId || s || def);
      })
      .catch(() => {
        if (!cached?.length) setMsg("Offline — using last saved store if available");
      });
  }, [selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) setSellingStore(selectedStoreId);
  }, [selectedStoreId]);

  const activeParent = useMemo(
    () => categories.find((c) => c.slug === parentSlug) ?? null,
    [categories, parentSlug],
  );

  const activeSub = useMemo(() => {
    if (!activeParent?.children?.length) return null;
    return activeParent.children.find((c) => c.slug === subSlug) ?? null;
  }, [activeParent, subSlug]);

  const activeCategory = activeSub ?? activeParent;
  const categorySlug = activeCategory?.slug ?? null;

  const loadVariants = useCallback(() => {
    if (!categorySlug) {
      setVariants([]);
      return;
    }
    const cacheKey = `${categorySlug}:${selectedStoreId || "all"}`;
    setLoading(true);
    const params = new URLSearchParams({ category_slug: categorySlug, include_stores: "1" });
    if (selectedStoreId) params.set("shop_id", selectedStoreId);

    apiFetch<{ variants: VariantTile[] }>(`/variants?${params}`)
      .then((d) => {
        const list = d.variants ?? [];
        setVariants(list);
        cacheVariants(cacheKey, list);
      })
      .catch(() => {
        const cached = getCachedVariants<VariantTile[]>(cacheKey);
        setVariants(cached ?? []);
        if (!cached?.length) setMsg("Offline — no cached stock for this category yet");
      })
      .finally(() => setLoading(false));
  }, [categorySlug, selectedStoreId]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  const groupedByProduct = useMemo(() => {
    const map = new Map<string, VariantTile[]>();
    for (const v of variants) {
      const list = map.get(v.product) ?? [];
      list.push(v);
      map.set(v.product, list);
    }
    return map;
  }, [variants]);

  const totals = useMemo(() => {
    let gross = 0;
    let lineDisc = 0;
    let net = 0;
    for (const line of cart) {
      const g = line.list_price * line.quantity;
      const n = line.sale_price * line.quantity;
      gross += g;
      lineDisc += Math.max(0, g - n);
      net += n;
    }
    const finalNet = Math.max(0, net - overallDiscount);
    return { gross, lineDisc, net, finalNet };
  }, [cart, overallDiscount]);

  function addToCart(v: VariantTile) {
    if (!sellingStore) {
      setMsg("Select a store first");
      return;
    }
    const stocks = v.stores ?? [];
    const stock =
      stocks.find((s) => s.store_id === sellingStore && s.quantity > 0) ??
      stocks.find((s) => s.store_id === sellingStore) ??
      stocks.find((s) => s.quantity > 0);
    const invShop = stock?.store_id ?? sellingStore;
    const invName = shops.find((s) => s.id === invShop)?.name ?? stock?.store_name ?? "Store";
    const label = variantLabel(v);
    const existing = cart.find(
      (c) => c.variant_id === v.id && c.inventory_shop_id === invShop && !c.external_source_shop_name,
    );
    if (existing) {
      setCart((prev) =>
        prev.map((c) => (c.key === existing.key ? { ...c, quantity: c.quantity + 1 } : c)),
      );
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: `${v.id}-${invShop}-${Date.now()}`,
        variant_id: v.id,
        product: v.product,
        variant_label: label,
        list_price: v.price,
        sale_price: v.price,
        quantity: 1,
        inventory_shop_id: invShop,
        inventory_shop_name: invName,
        store_stocks: stocks,
      },
    ]);
    setMsg("");
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  async function checkout() {
    if (!sellingStore || cart.length === 0) return;
    setMsg("");
    const payload: CheckoutPayload = {
      shop_id: sellingStore,
      payment_method: payment,
      overall_discount: overallDiscount,
      items: cart.map((c) => ({
        product_variant_id: c.variant_id,
        quantity: c.quantity,
        sale_price: c.sale_price,
        inventory_shop_id:
          c.external_source_shop_name
            ? undefined
            : c.inventory_shop_id !== sellingStore
              ? c.inventory_shop_id
              : undefined,
        external_source_shop_name: c.external_source_shop_name || undefined,
      })),
    };

    if (!isOnline()) {
      enqueueSale(payload);
      setCart([]);
      refreshPending();
      setMsg(`Saved offline — ${payload.items.length} item(s) will sync when online`);
      return;
    }

    try {
      const res = await apiFetch<{ net_total: number; order_id: string }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCart([]);
      setOverallDiscount(0);
      setMsg(`Sale complete — KES ${res.net_total.toLocaleString()}`);
      loadVariants();
    } catch (e) {
      if (!isOnline()) {
        enqueueSale(payload);
        setCart([]);
        refreshPending();
        setMsg("Connection lost — sale queued for sync");
      } else {
        setMsg(e instanceof Error ? e.message : "Checkout failed");
      }
    }
  }

  return (
    <AppShell compact>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm sm:mb-4 sm:gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs ${online ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
        >
          {online ? "Online" : "Offline"}
        </span>
        {pending > 0 && (
          <span className="text-[10px] text-amber-800 sm:text-xs">{pending} sale(s) to sync</span>
        )}
      </div>

      {(msg || syncMsg) && (
        <p
          className="mb-2 text-xs text-[var(--muted)] sm:mb-4 sm:text-sm"
          onClick={() => {
            setMsg("");
            clearMsg();
          }}
        >
          {syncMsg || msg}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
        <section className="neu-flat min-w-0 p-2.5 sm:p-4">
          <div className="mb-3">
            <label className="mb-1 block text-[10px] text-[var(--muted)] sm:text-xs">Selling store</label>
            <select
              value={sellingStore}
              onChange={(e) => setSellingStore(e.target.value)}
              className="neu-inset w-full px-3 py-2 text-sm sm:max-w-xs"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--muted)] sm:text-xs">
            Categories <span className="normal-case tracking-normal">(swipe →)</span>
          </p>
          <div className="touch-scroll-x scrollbar-hide flex gap-1.5 pb-1 sm:gap-2 sm:pb-2">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  setParentSlug(cat.slug);
                  setSubSlug(cat.children?.[0]?.slug ?? null);
                }}
                className={`neu-btn shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:px-4 sm:py-2 sm:text-sm ${
                  parentSlug === cat.slug ? "active accent-text" : ""
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {activeParent && (activeParent.children?.length ?? 0) > 0 && (
            <>
              <p className="mb-1.5 mt-2.5 text-[10px] uppercase tracking-widest text-[var(--muted)] sm:text-xs">
                Type <span className="normal-case tracking-normal">(swipe →)</span>
              </p>
              <div className="touch-scroll-x scrollbar-hide flex gap-1.5 pb-1 sm:gap-2">
                {activeParent.children!.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => setSubSlug(sub.slug)}
                    className={`neu-btn shrink-0 whitespace-nowrap px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs ${
                      subSlug === sub.slug ? "active accent-text" : ""
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-4 sm:mt-6">
            {!activeCategory ? (
              <div className="neu-inset grid min-h-[120px] place-items-center p-6 text-center sm:min-h-[200px] sm:p-8">
                <p className="text-xs text-[var(--muted)] sm:text-sm">Swipe a category above to start</p>
              </div>
            ) : loading ? (
              <div className="neu-inset grid min-h-[120px] place-items-center p-6 text-center sm:min-h-[200px]">
                <p className="text-xs text-[var(--muted)] sm:text-sm">Loading {activeCategory.name}…</p>
              </div>
            ) : groupedByProduct.size === 0 ? (
              <div className="neu-inset grid min-h-[120px] place-items-center p-6 text-center sm:min-h-[200px]">
                <p className="text-xs text-[var(--muted)] sm:text-sm">No variants for {activeCategory.name}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...groupedByProduct.entries()].map(([productName, items]) => (
                  <div key={productName}>
                    <p className="mb-1.5 text-xs font-semibold sm:mb-2 sm:text-sm">{productName}</p>
                    <div className="touch-scroll-x scrollbar-hide flex gap-2 pb-1 lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:pb-0 xl:grid-cols-3">
                      {items.map((v) => {
                        const storeStock = selectedStoreId
                          ? v.stock
                          : v.stores?.reduce((sum, s) => sum + s.quantity, 0);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => addToCart(v)}
                            className="neu-btn w-[min(42vw,9.5rem)] shrink-0 p-2.5 text-left text-xs sm:w-auto sm:min-w-[8.5rem] sm:p-3 sm:text-sm lg:w-auto lg:shrink"
                          >
                            <p className="line-clamp-2 font-medium leading-tight">{variantLabel(v)}</p>
                            <p className="mt-1 text-[11px] font-semibold accent-text sm:text-xs">
                              KES {v.price.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-[var(--muted)] sm:text-xs">Stock: {storeStock ?? 0}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="neu-flat flex flex-col p-2.5 sm:p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide accent-text sm:mb-4 sm:text-sm">
            Current Sale {cart.length > 0 && `(${cart.length})`}
          </h2>
          <div className="neu-inset space-y-3 p-2.5 text-xs sm:p-3 sm:text-sm">
            {cart.length === 0 ? (
              <p className="text-[var(--muted)]">Tap a product to add to cart</p>
            ) : (
              cart.map((line) => {
                const lineDisc = Math.max(0, (line.list_price - line.sale_price) * line.quantity);
                return (
                  <div key={line.key} className="border-b border-[var(--shadow-dark)]/20 pb-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{line.product}</span>
                      <button
                        type="button"
                        className="text-xs text-red-700"
                        onClick={() => setCart((p) => p.filter((c) => c.key !== line.key))}
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{line.variant_label}</p>
                    <div className="mt-2 grid gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted)]">Qty</span>
                        <button type="button" className="neu-btn px-2 py-0.5 text-xs" onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}>−</button>
                        <span>{line.quantity}</span>
                        <button type="button" className="neu-btn px-2 py-0.5 text-xs" onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}>+</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-[var(--muted)]">Price</label>
                        <input
                          type="number"
                          min={0}
                          value={line.sale_price}
                          onChange={(e) => updateLine(line.key, { sale_price: Number(e.target.value) })}
                          className="neu-inset w-24 px-2 py-1 text-xs"
                        />
                        {lineDisc > 0 ? (
                          <span className="text-[10px] leading-tight text-red-700">
                            <span className="line-through text-[var(--muted)]">
                              KES {line.list_price.toLocaleString()}
                            </span>
                            {" · "}
                            −KES {lineDisc.toLocaleString()} disc
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)]">list KES {line.list_price.toLocaleString()}</span>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Stock from</label>
                        <select
                          value={line.external_source_shop_name ? STOCK_EXTERNAL : line.inventory_shop_id}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === STOCK_EXTERNAL) {
                              updateLine(line.key, {
                                inventory_shop_id: sellingStore,
                                inventory_shop_name: "External",
                                external_source_shop_name: "",
                              });
                            } else {
                              const shop = shops.find((s) => s.id === v);
                              updateLine(line.key, {
                                inventory_shop_id: v,
                                inventory_shop_name: shop?.name ?? "",
                                external_source_shop_name: undefined,
                              });
                            }
                          }}
                          className="neu-inset mt-1 w-full px-2 py-1 text-xs"
                        >
                          {shops.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({line.store_stocks.find((st) => st.store_id === s.id)?.quantity ?? 0})
                            </option>
                          ))}
                          <option value={STOCK_EXTERNAL}>Other shop (borrowed)</option>
                        </select>
                        {line.external_source_shop_name !== undefined && (
                          <input
                            value={line.external_source_shop_name}
                            onChange={(e) => updateLine(line.key, { external_source_shop_name: e.target.value })}
                            placeholder="Name of shop stock came from"
                            className="neu-inset mt-1 w-full px-2 py-1 text-xs"
                          />
                        )}
                        {line.inventory_shop_id !== sellingStore && !line.external_source_shop_name && (
                          <p className="mt-1 text-xs accent-text">Borrowed from {line.inventory_shop_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-3 space-y-2 text-xs sm:mt-4 sm:text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Gross</span>
              <span>KES {totals.gross.toLocaleString()}</span>
            </div>
            {totals.lineDisc > 0 && (
              <div className="flex justify-between text-xs text-red-700">
                <span>Item discounts</span>
                <span>−KES {totals.lineDisc.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--muted)]">Overall discount</span>
              <input
                type="number"
                min={0}
                value={overallDiscount}
                onChange={(e) => setOverallDiscount(Number(e.target.value))}
                className="neu-inset w-24 px-2 py-1 text-right text-xs"
              />
            </div>
            <div className="flex gap-2">
              {(["cash", "mpesa", "card"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayment(m)}
                  className={`neu-btn flex-1 py-2 text-xs capitalize ${payment === m ? "active accent-text" : ""}`}
                >
                  {m === "mpesa" ? "M-Pesa" : m}
                </button>
              ))}
            </div>
            <div className="flex justify-between border-t border-[var(--shadow-dark)]/30 pt-2 font-semibold">
              <span>Total (net)</span>
              <span className="accent-text">KES {totals.finalNet.toLocaleString()}</span>
            </div>
            {(totals.lineDisc > 0 || overallDiscount > 0) && (
              <p className="text-[10px] leading-snug text-[var(--muted)]">
                Discounts sync to the database and reduce revenue / profit totals.
              </p>
            )}
            <button
              type="button"
              disabled={cart.length === 0 || !sellingStore}
              onClick={checkout}
              className="neu-btn w-full py-2.5 text-sm font-semibold accent-text disabled:opacity-40 sm:py-3"
            >
              {online ? "Complete Sale" : "Save Offline"}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
