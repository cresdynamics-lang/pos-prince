"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/auth";
import {
  cacheCatalog,
  cacheVariants,
  enqueueSale,
  getCachedCatalog,
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
};

function variantLabel(v: VariantTile) {
  const parts = [v.color, v.size ? `Size ${v.size}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Standard";
}

export function PosView({ categories }: { categories: Category[] }) {
  const { selectedStoreId } = useStore();
  const { online, pending, syncMsg, clearMsg } = useOfflineSync();
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantTile[]>([]);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sellingStore, setSellingStore] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    cacheCatalog(categories);
  }, [categories]);

  useEffect(() => {
    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => {
        const list = d.shops ?? [];
        setShops(list);
        const def = selectedStoreId || list[0]?.id || "";
        if (def) setSellingStore((s) => selectedStoreId || s || def);
      })
      .catch(() => {});
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

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + l.sale_price * l.quantity, 0),
    [cart],
  );

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
    const existing = cart.find((c) => c.variant_id === v.id && c.inventory_shop_id === invShop);
    if (existing) {
      setCart((prev) =>
        prev.map((c) => (c.key === existing.key ? { ...c, quantity: c.quantity + 1 } : c)),
      );
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: `${v.id}-${invShop}`,
        variant_id: v.id,
        product: v.product,
        variant_label: label,
        list_price: v.price,
        sale_price: v.price,
        quantity: 1,
        inventory_shop_id: invShop,
        inventory_shop_name: invName,
      },
    ]);
    setMsg("");
  }

  async function checkout() {
    if (!sellingStore || cart.length === 0) return;
    setMsg("");
    const payload: CheckoutPayload = {
      shop_id: sellingStore,
      payment_method: payment,
      overall_discount: 0,
      items: cart.map((c) => ({
        product_variant_id: c.variant_id,
        quantity: c.quantity,
        sale_price: c.sale_price,
        inventory_shop_id: c.inventory_shop_id !== sellingStore ? c.inventory_shop_id : undefined,
      })),
    };

    if (!isOnline()) {
      enqueueSale(payload);
      setCart([]);
      setMsg(`Saved offline — ${payload.items.length} item(s) will sync when online`);
      return;
    }

    try {
      const res = await apiFetch<{ net_total: number; order_id: string }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCart([]);
      setMsg(`Sale complete — KES ${res.net_total.toLocaleString()}`);
      loadVariants();
    } catch (e) {
      if (!isOnline()) {
        enqueueSale(payload);
        setCart([]);
        setMsg("Connection lost — sale queued for sync");
      } else {
        setMsg(e instanceof Error ? e.message : "Checkout failed");
      }
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span
          className={`rounded-full px-3 py-1 text-xs ${online ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
        >
          {online ? "Online" : "Offline mode"}
        </span>
        {pending > 0 && (
          <span className="text-xs text-amber-800">{pending} sale(s) waiting to sync</span>
        )}
        {!online && (
          <span className="text-xs text-[var(--muted)]">Catalog &amp; cart work offline; sales sync when connected</span>
        )}
      </div>

      {(msg || syncMsg) && (
        <p
          className="mb-4 text-sm text-[var(--muted)]"
          onClick={() => {
            setMsg("");
            clearMsg();
          }}
        >
          {syncMsg || msg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="neu-flat p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Selling store</label>
              <select
                value={sellingStore}
                onChange={(e) => setSellingStore(e.target.value)}
                className="neu-inset px-3 py-2 text-sm"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Categories</p>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  setParentSlug(cat.slug);
                  setSubSlug(cat.children?.[0]?.slug ?? null);
                }}
                className={`neu-btn shrink-0 px-4 py-2 text-sm ${
                  parentSlug === cat.slug ? "active accent-text" : ""
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {activeParent && (activeParent.children?.length ?? 0) > 0 && (
            <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
              {activeParent.children!.map((sub) => (
                <button
                  key={sub.slug}
                  type="button"
                  onClick={() => setSubSlug(sub.slug)}
                  className={`neu-btn shrink-0 px-3 py-1.5 text-xs ${
                    subSlug === sub.slug ? "active accent-text" : ""
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 min-h-[280px]">
            {!activeCategory ? (
              <div className="neu-inset grid min-h-[280px] place-items-center p-8 text-center">
                <p className="text-sm text-[var(--muted)]">Select a category to start a sale</p>
              </div>
            ) : loading ? (
              <div className="neu-inset grid min-h-[280px] place-items-center p-8 text-center">
                <p className="text-sm text-[var(--muted)]">Loading {activeCategory.name}…</p>
              </div>
            ) : groupedByProduct.size === 0 ? (
              <div className="neu-inset grid min-h-[280px] place-items-center p-8 text-center">
                <p className="text-sm text-[var(--muted)]">No variants for {activeCategory.name}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...groupedByProduct.entries()].map(([productName, items]) => (
                  <div key={productName}>
                    <p className="mb-2 text-sm font-semibold">{productName}</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((v) => {
                        const storeStock = selectedStoreId
                          ? v.stock
                          : v.stores?.reduce((sum, s) => sum + s.quantity, 0);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => addToCart(v)}
                            className="neu-btn p-3 text-left text-sm"
                          >
                            <p className="font-medium">{variantLabel(v)}</p>
                            <p className="mt-1 text-xs accent-text font-semibold">
                              KES {v.price.toLocaleString()}
                            </p>
                            <p className="text-xs text-[var(--muted)]">Stock: {storeStock ?? 0}</p>
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

        <aside className="neu-flat flex flex-col p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide accent-text">Current Sale</h2>
          <div className="neu-inset min-h-[200px] flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {cart.length === 0 ? (
              <p className="text-[var(--muted)]">Tap a variant to add to cart</p>
            ) : (
              cart.map((line) => (
                <div key={line.key} className="border-b border-[var(--shadow-dark)]/20 pb-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{line.product}</span>
                    <button type="button" className="text-xs text-red-700" onClick={() => setCart((p) => p.filter((c) => c.key !== line.key))}>
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{line.variant_label}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" className="neu-btn px-2 py-0.5 text-xs" onClick={() => setCart((p) => p.map((c) => c.key === line.key && c.quantity > 1 ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.key !== line.key || c.quantity > 0))}>−</button>
                    <span>{line.quantity}</span>
                    <button type="button" className="neu-btn px-2 py-0.5 text-xs" onClick={() => setCart((p) => p.map((c) => c.key === line.key ? { ...c, quantity: c.quantity + 1 } : c))}>+</button>
                    <span className="ml-auto accent-text">KES {(line.sale_price * line.quantity).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 space-y-3">
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
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="accent-text">KES {total.toLocaleString()}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || !sellingStore}
              onClick={checkout}
              className="neu-btn w-full py-3 text-sm font-semibold accent-text disabled:opacity-40"
            >
              {online ? "Complete Sale" : "Save Offline"}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
