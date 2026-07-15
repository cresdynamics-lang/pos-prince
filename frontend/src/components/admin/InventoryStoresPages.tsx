"use client";

import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { CategoryAccordion } from "@/components/CategoryAccordion";
import { CategoryCrudPanel } from "@/components/admin/CategoryCrudPanel";
import { ProductCrudPanel } from "@/components/admin/ProductCrudPanel";
import { ProductDetailPanel } from "@/components/admin/ProductDetailPanel";
import { SelectStorePrompt } from "@/components/admin/SelectStorePrompt";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";
import { FALLBACK_CATEGORIES, type Category } from "@/lib/catalog";
import { apiFetch, getUser, hasPermission, PERMS } from "@/lib/auth";
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
};

type Tab = "stock" | "products" | "categories";

export function InventoryAdminPage() {
  const { selectedStoreId, isAllStores, selectedStore } = useStore();
  const me = getUser();
  const canEdit = hasPermission(me, PERMS.inventoryEdit);
  const canEditHere = canEdit && !isAllStores;
  const [tab, setTab] = useState<Tab>("stock");
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [selected, setSelected] = useState<string | null>(null);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [pickStoreMsg, setPickStoreMsg] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [stockMsg, setStockMsg] = useState("");

  const loadCategories = useCallback(() => {
    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => d.categories && setCategories(d.categories))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedStoreId) params.set("shop_id", selectedStoreId);
    if (selected) params.set("category_slug", selected);
    apiFetch<{ inventory: InventoryRow[] }>(`/inventory?${params}`)
      .then((d) => setRows(d.inventory ?? []))
      .catch(() => setRows([]));
  }, [selectedStoreId, selected]);

  useEffect(() => {
    loadCategories();
    apiFetch<{ shops: { id: string; name: string }[] }>("/shops")
      .then((d) => setShops(d.shops ?? []))
      .catch(() => {});
  }, [loadCategories]);

  // Live refresh whenever store, category, or tab changes.
  useEffect(() => {
    if (isAllStores) {
      setActiveVariant(null);
      setEditingRowId(null);
    }
    setPickStoreMsg("");
    setStockMsg("");
    setEditingRowId(null);
    if (tab === "stock") load();
  }, [isAllStores, selectedStoreId, selected, tab, load]);

  function openVariantFromProduct(variantId: string) {
    if (isAllStores) {
      setPickStoreMsg("Select a specific store in the header to update products for that location.");
      return;
    }
    setActiveVariant(variantId);
    setTab("stock");
  }

  function handleStockRowClick(variantId: string) {
    if (isAllStores) {
      setPickStoreMsg("Select a specific store in the header to add or adjust stock for that location.");
      return;
    }
    setActiveVariant(variantId);
    setPickStoreMsg("");
  }

  function startInlineEdit(r: InventoryRow, e: MouseEvent) {
    e.stopPropagation();
    if (!canEditHere) return;
    setEditingRowId(r.id);
    setEditQty(r.quantity);
    setStockMsg("");
  }

  async function saveInlineQty(r: InventoryRow, e?: FormEvent | MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canEditHere || !selectedStoreId) return;
    const shopId = r.shop_id || selectedStoreId;
    setSavingRowId(r.id);
    setStockMsg("");
    try {
      const res = await apiFetch<{ quantity: number }>("/inventory/set", {
        method: "POST",
        body: JSON.stringify({
          shop_id: shopId,
          product_variant_id: r.product_variant_id,
          quantity: Math.max(0, Math.floor(editQty)),
        }),
      });
      setRows((prev) =>
        prev.map((row) => (row.id === r.id ? { ...row, quantity: res.quantity } : row)),
      );
      setEditingRowId(null);
      setStockMsg(`Updated on hand to ${res.quantity} at ${selectedStore?.name ?? "store"}`);
      load();
    } catch (err) {
      setStockMsg(err instanceof Error ? err.message : "Could not update stock");
    } finally {
      setSavingRowId(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "Stock" },
    ...(canEdit
      ? ([
          { id: "products" as Tab, label: "Products" },
          { id: "categories" as Tab, label: "Categories" },
        ] as const)
      : []),
  ];

  return (
    <div className="space-y-4">
      <StoreScopeBanner
        hint={
          isAllStores
            ? "Stock is read-only across all stores. Pick one store in the header to update inventory."
            : `Live stock for ${selectedStore?.name ?? "this store"} — switch store in the header to load that location’s inventory.`
        }
      />

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

      {pickStoreMsg && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {pickStoreMsg}
        </p>
      )}

      {tab === "stock" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            {isAllStores
              ? "View stock across all stores. Select a store in the header to edit quantities."
              : "Edit On hand inline, or click a row for add / set / transfer. Counts update live for the selected store."}
          </p>
          {stockMsg && <p className="text-xs accent-text">{stockMsg}</p>}
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto">
              <p className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Category</p>
              <CategoryAccordion categories={categories} selectedSlug={selected} onSelect={setSelected} />
            </aside>
            <section className="neu-flat overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
                    <th className="px-3 py-3">Product</th>
                    {isAllStores && <th className="px-3 py-3">Store</th>}
                    <th className="px-3 py-3">Size</th>
                    <th className="px-3 py-3">Color</th>
                    <th className="px-3 py-3">Opening</th>
                    <th className="px-3 py-3">On hand</th>
                    <th className="px-3 py-3">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.id}-${r.shop_id}`}
                      className={`border-b border-[var(--shadow-dark)]/20 ${
                        canEditHere ? "cursor-pointer hover:opacity-80" : ""
                      } ${activeVariant === r.product_variant_id ? "bg-[var(--shadow-dark)]/10" : ""}`}
                      onClick={() => canEditHere && handleStockRowClick(r.product_variant_id)}
                    >
                      <td className="px-3 py-2">{r.product_name}</td>
                      {isAllStores && <td className="px-3 py-2 text-[var(--muted)]">{r.shop_name}</td>}
                      <td className="px-3 py-2">{r.size || "—"}</td>
                      <td className="px-3 py-2">{r.color || "—"}</td>
                      <td className="px-3 py-2">{r.opening_stock}</td>
                      <td className="px-3 py-2" onClick={(e) => canEditHere && e.stopPropagation()}>
                        {canEditHere && editingRowId === r.id ? (
                          <form className="flex items-center gap-1" onSubmit={(e) => saveInlineQty(r, e)}>
                            <input
                              type="number"
                              min={0}
                              autoFocus
                              value={editQty}
                              onChange={(e) => setEditQty(Number(e.target.value))}
                              className="neu-inset w-16 px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              disabled={savingRowId === r.id}
                              className="neu-btn px-2 py-1 text-[10px] accent-text disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="neu-btn px-2 py-1 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRowId(null);
                              }}
                            >
                              ×
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className={`font-medium accent-text ${canEditHere ? "underline decoration-dotted" : ""}`}
                            onClick={(e) => startInlineEdit(r, e)}
                            title={canEditHere ? "Edit on-hand for this store" : undefined}
                            disabled={!canEditHere}
                          >
                            {r.quantity}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{r.sku}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAllStores ? 7 : 6} className="px-4 py-8 text-center text-[var(--muted)]">
                        No stock in this view. Select a store and add opening stock from a product row.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {tab === "products" &&
        (isAllStores ? (
          <SelectStorePrompt action="add or update products" />
        ) : (
          <ProductCrudPanel
            categories={categories}
            canEdit={canEditHere}
            storeId={selectedStoreId}
            onChanged={() => {
              loadCategories();
              load();
            }}
            onOpenVariant={openVariantFromProduct}
          />
        ))}

      {tab === "categories" &&
        (isAllStores ? (
          <SelectStorePrompt action="manage categories and catalog setup" />
        ) : (
          <CategoryCrudPanel categories={categories} canEdit={canEditHere} onChanged={loadCategories} />
        ))}

      {activeVariant && !isAllStores && (
        <ProductDetailPanel
          key={`${activeVariant}-${selectedStoreId}`}
          variantId={activeVariant}
          shops={shops}
          categories={categories}
          canEditInventory={canEditHere}
          lockedStoreId={selectedStoreId}
          onClose={() => setActiveVariant(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
