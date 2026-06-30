"use client";

import { useCallback, useEffect, useState } from "react";
import { CategoryAccordion } from "@/components/CategoryAccordion";
import { CategoryCrudPanel } from "@/components/admin/CategoryCrudPanel";
import { ProductCrudPanel } from "@/components/admin/ProductCrudPanel";
import { ProductDetailPanel } from "@/components/admin/ProductDetailPanel";
import { FALLBACK_CATEGORIES, type Category } from "@/lib/catalog";
import { apiFetch } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

type InventoryRow = {
  id: string;
  product_variant_id: string;
  shop_id: string;
  shop_name: string;
  product_name: string;
  category: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  opening_stock: number;
  closing_stock: number;
  units_sold_today: number;
};

type Shop = { id: string; name: string };

type Tab = "stock" | "products" | "categories";

export function InventoryAdminPage() {
  const { selectedStoreId } = useStore();
  const [tab, setTab] = useState<Tab>("stock");
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [selected, setSelected] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);

  const loadCategories = useCallback(() => {
    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => d.categories && setCategories(d.categories))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (storeFilter) params.set("shop_id", storeFilter);
    if (selected) params.set("category_slug", selected);
    apiFetch<{ inventory: InventoryRow[] }>(`/inventory?${params}`)
      .then((d) => setRows(d.inventory ?? []))
      .catch(() => setRows([]));
  }, [storeFilter, selected]);

  useEffect(() => {
    loadCategories();
    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => {
        const list = d.shops ?? [];
        setShops(list);
        const defaultStore = selectedStoreId || list[0]?.id || "";
        if (defaultStore) setStoreFilter((f) => selectedStoreId || f || defaultStore);
      })
      .catch(() => {});
  }, [loadCategories, selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) setStoreFilter(selectedStoreId);
  }, [selectedStoreId]);

  useEffect(() => {
    if (tab === "stock") load();
  }, [tab, load]);

  function openVariantFromProduct(variantId: string) {
    setActiveVariant(variantId);
    setTab("stock");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "Stock" },
    { id: "products", label: "Products" },
    { id: "categories", label: "Categories" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`neu-btn px-4 py-2 text-sm ${tab === t.id ? "active accent-text" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            Click any row to update product details, add stock, move between stores, or record a sale.
          </p>
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto">
              <p className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Filter by category</p>
              <CategoryAccordion categories={categories} selectedSlug={selected} onSelect={setSelected} />
              <p className="mb-2 mt-6 text-xs uppercase tracking-widest text-[var(--muted)]">Store</p>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="neu-inset w-full px-3 py-2 text-sm"
              >
                <option value="">All stores</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </aside>
            <section className="neu-flat overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Store</th>
                    <th className="px-3 py-3">Size</th>
                    <th className="px-3 py-3">Color</th>
                    <th className="px-3 py-3">Opening</th>
                    <th className="px-3 py-3">Sold</th>
                    <th className="px-3 py-3">Closing</th>
                    <th className="px-3 py-3">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[var(--shadow-dark)]/20 cursor-pointer hover:opacity-80 ${
                        activeVariant === r.product_variant_id ? "bg-[var(--shadow-dark)]/10" : ""
                      }`}
                      onClick={() => setActiveVariant(r.product_variant_id)}
                    >
                      <td className="px-3 py-2">{r.product_name}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{r.shop_name}</td>
                      <td className="px-3 py-2">{r.size || "—"}</td>
                      <td className="px-3 py-2">{r.color || "—"}</td>
                      <td className="px-3 py-2">{r.opening_stock}</td>
                      <td className="px-3 py-2">{r.units_sold_today}</td>
                      <td className="px-3 py-2 font-medium accent-text">{r.closing_stock}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{r.sku}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-[var(--muted)]">
                        No stock in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {tab === "products" && (
        <ProductCrudPanel
          categories={categories}
          onChanged={() => {
            loadCategories();
            load();
          }}
          onOpenVariant={openVariantFromProduct}
        />
      )}

      {tab === "categories" && (
        <CategoryCrudPanel categories={categories} onChanged={loadCategories} />
      )}

      {activeVariant && (
        <ProductDetailPanel
          variantId={activeVariant}
          shops={shops}
          categories={categories}
          onClose={() => setActiveVariant(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
