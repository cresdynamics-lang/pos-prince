"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CategoryAccordion } from "@/components/CategoryAccordion";
import type { Category } from "@/lib/api";
import { apiFetch } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

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

export function PosView({ categories }: { categories: Category[] }) {
  const { selectedStoreId } = useStore();
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantTile[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!categorySlug) {
      setVariants([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ category_slug: categorySlug, include_stores: "1" });
    if (selectedStoreId) params.set("shop_id", selectedStoreId);
    apiFetch<{ variants: VariantTile[] }>(`/variants?${params}`)
      .then((d) => setVariants(d.variants ?? []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }, [categorySlug, selectedStoreId]);

  const groupedByProduct = useMemo(() => {
    const map = new Map<string, VariantTile[]>();
    for (const v of variants) {
      const list = map.get(v.product) ?? [];
      list.push(v);
      map.set(v.product, list);
    }
    return map;
  }, [variants]);

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="neu-flat p-4">
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
                <div>
                  <p className="text-lg font-semibold">{activeCategory.name}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    No stock set up yet. Configure this product in Admin → Inventory → Products.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                  {activeCategory.name} — pick a size/color variant. Stock shown per store.
                </p>
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
                            disabled={(storeStock ?? 0) <= 0}
                            className="neu-btn p-3 text-left text-sm disabled:opacity-40"
                          >
                            <p className="font-medium">
                              {[v.size, v.color].filter(Boolean).join(" · ") || "Standard"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              KES {v.price.toLocaleString()} · Stock: {storeStock ?? 0}
                            </p>
                            {!selectedStoreId && v.stores && v.stores.length > 1 && (
                              <p className="mt-1 text-[10px] text-[var(--muted)]">
                                {v.stores.map((s) => `${s.store_name}: ${s.quantity}`).join(" · ")}
                              </p>
                            )}
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
          <div className="neu-inset flex-1 p-4 text-sm text-[var(--muted)]">Cart is empty</div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total</span>
              <span className="font-semibold">KES 0</span>
            </div>
            <button type="button" className="neu-btn w-full py-3 text-sm font-semibold accent-text">
              Complete Sale
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

export function InventoryView({ categories }: { categories: Category[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <p className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Filter by category</p>
          <CategoryAccordion categories={categories} selectedSlug={selected} onSelect={setSelected} />
        </aside>
        <section className="neu-flat p-6">
          <h2 className="text-lg font-semibold">Stock by shop</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {selected
              ? `Showing inventory for selected category — connect API + seed products to populate.`
              : "Select a category or view all shops once products are seeded."}
          </p>
          <div className="neu-inset mt-6 min-h-[320px] p-6 text-sm text-[var(--muted)]">
            Inventory grid — per-shop quantities, reorder alerts, transfer actions.
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export function DashboardView() {
  const cards = [
    { label: "Today's Sales", value: "—" },
    { label: "Units Sold", value: "—" },
    { label: "Low Stock Items", value: "—" },
    { label: "Pending Transfers", value: "—" },
  ];

  return (
    <AppShell>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="neu-flat p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold accent-text">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="neu-flat mt-6 p-6">
        <h2 className="font-semibold">Reports &amp; marketing ROI</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sales graphs, daily close-out, and marketing spend tracking — wired after transactions flow.
        </p>
      </div>
    </AppShell>
  );
}
