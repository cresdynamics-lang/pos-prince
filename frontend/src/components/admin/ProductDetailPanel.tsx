"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCategoryOptions } from "@/components/admin/CategoryCrudPanel";
import type { Category } from "@/lib/catalog";
import { apiFetch } from "@/lib/auth";

type VariantDetail = {
  id: string;
  product_id: string;
  category_id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  product_name: string;
  category: string;
  base_price: number;
  cost_price: number;
  brand?: string | null;
  is_active: boolean;
};

type StoreStock = {
  store_id: string;
  store_name: string;
  quantity: number;
  opening_stock: number;
  closing_stock: number;
  units_sold_today: number;
};

type Shop = { id: string; name: string };

type Props = {
  variantId: string | null;
  shops: Shop[];
  categories: Category[];
  onClose: () => void;
  onUpdated: () => void;
  canEditInventory?: boolean;
  defaultShopId?: string;
};

export function ProductDetailPanel({
  variantId,
  shops,
  categories,
  onClose,
  onUpdated,
  canEditInventory = true,
  defaultShopId = "",
}: Props) {
  const tabs = useMemo(
    () =>
      [
        { id: "details" as const, label: "Details", show: canEditInventory },
        { id: "stock" as const, label: "Add stock", show: canEditInventory },
        { id: "transfer" as const, label: "Move stock", show: canEditInventory },
      ].filter((t) => t.show),
    [canEditInventory],
  );
  const categoryOptions = useCategoryOptions(categories);
  const [variant, setVariant] = useState<VariantDetail | null>(null);
  const [stores, setStores] = useState<StoreStock[]>([]);
  const [section, setSection] = useState<"details" | "stock" | "transfer">("details");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [brand, setBrand] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [addStore, setAddStore] = useState("");
  const [addQty, setAddQty] = useState(5);
  const [fromStore, setFromStore] = useState("");
  const [toStore, setToStore] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [newSize, setNewSize] = useState("");
  const [newVariantQty, setNewVariantQty] = useState(0);
  const [setQtyStore, setSetQtyStore] = useState("");
  const [setQtyValue, setSetQtyValue] = useState(0);

  const load = useCallback(() => {
    if (!variantId) return;
    apiFetch<{ variant: VariantDetail; stores: StoreStock[] }>(`/variants/${variantId}`)
      .then((d) => {
        setVariant(d.variant);
        setStores(d.stores ?? []);
        setName(d.variant.product_name);
        setCategoryId(d.variant.category_id);
        setBasePrice(d.variant.base_price);
        setCostPrice(d.variant.cost_price);
        setBrand(d.variant.brand ?? "");
        setIsActive(d.variant.is_active);
        if (d.stores?.[0]) {
          const preferred =
            defaultShopId && d.stores.find((s) => s.store_id === defaultShopId)?.store_id;
          const first = preferred ?? d.stores[0].store_id;
          setAddStore(first);
          setFromStore(first);
        }
        if (d.stores?.[1]) setToStore(d.stores[1].store_id);
      })
      .catch(() => setMsg("Could not load product"));
  }, [variantId, defaultShopId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === section)) {
      setSection(tabs[0].id);
    }
  }, [section, tabs]);

  if (!variantId) return null;

  async function saveProduct() {
    if (!variant) return;
    setMsg("");
    try {
      await apiFetch(`/products/${variant.product_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          category_id: categoryId,
          base_price: basePrice,
          cost_price: costPrice,
          brand: brand || null,
          is_active: isActive,
        }),
      });
      setMsg("Product saved");
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function addStock() {
    setMsg("");
    try {
      const res = await apiFetch<{ quantity: number }>("/inventory/add", {
        method: "POST",
        body: JSON.stringify({ shop_id: addStore, product_variant_id: variantId, quantity: addQty }),
      });
      setMsg(`Stock added — now ${res.quantity} at store`);
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Add stock failed");
    }
  }

  async function setStockQty() {
    if (!variantId || !setQtyStore) return;
    setMsg("");
    try {
      const res = await apiFetch<{ quantity: number }>("/inventory/set", {
        method: "POST",
        body: JSON.stringify({
          shop_id: setQtyStore,
          product_variant_id: variantId,
          quantity: setQtyValue,
        }),
      });
      setMsg(`Stock set to ${res.quantity}`);
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not set stock");
    }
  }

  async function addVariantSize() {
    if (!variant?.product_id || !addStore) return;
    setMsg("");
    try {
      await apiFetch("/variants", {
        method: "POST",
        body: JSON.stringify({
          product_id: variant.product_id,
          size: newSize,
          shop_id: addStore,
          initial_quantity: newVariantQty,
        }),
      });
      setMsg(newSize ? `Added size ${newSize}` : "Variant added");
      setNewSize("");
      setNewVariantQty(0);
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not add variant");
    }
  }

  async function transferStock() {
    setMsg("");
    try {
      await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          product_variant_id: variantId,
          source_shop_id: fromStore,
          destination_shop_id: toStore,
          quantity: transferQty,
        }),
      });
      setMsg("Stock transferred");
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="neu-flat flex h-full w-full max-w-lg flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--shadow-dark)]/20 p-6 pb-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-[var(--muted)]">{variant?.category ?? "…"}</p>
              <h2 className="text-lg font-semibold accent-text">{variant?.product_name ?? "Loading…"}</h2>
              <p className="text-xs text-[var(--muted)]">
                {variant?.color} {variant?.size ? `· Size ${variant.size}` : ""} · {variant?.sku}
              </p>
            </div>
            <button type="button" onClick={onClose} className="neu-btn px-3 py-1 text-sm">
              Close
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`neu-btn px-3 py-1.5 text-xs ${section === t.id ? "active accent-text" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
          <div className="neu-inset mb-4 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">Stock per store</p>
            {stores.map((s) => (
              <div key={s.store_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--shadow-dark)]/20 py-2 text-sm last:border-0">
                <span>{s.store_name}</span>
                <span>
                  Opening <strong>{s.opening_stock}</strong> · On hand{" "}
                  <strong className="accent-text">{s.quantity}</strong>
                </span>
              </div>
            ))}
          </div>

          {canEditInventory && (
            <div className="neu-inset mb-4 space-y-2 p-3 text-sm">
              <p className="text-xs font-medium uppercase text-[var(--muted)]">Set stock count</p>
              <select value={setQtyStore} onChange={(e) => setSetQtyStore(e.target.value)} className="neu-inset w-full px-2 py-1 text-xs">
                <option value="">Store</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="number" min={0} value={setQtyValue} onChange={(e) => setSetQtyValue(Number(e.target.value))} className="neu-inset w-full px-2 py-1 text-xs" placeholder="Quantity on hand" />
              <button type="button" onClick={setStockQty} className="neu-btn w-full py-2 text-xs accent-text">Update stock</button>
            </div>
          )}

          {section === "details" && (
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm" placeholder="Product name" />
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm">
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm" placeholder="Brand" />
              <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" placeholder="List price (KES)" />
              <input type="number" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" placeholder="Cost price (KES)" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active in catalog
              </label>
              <button type="button" onClick={saveProduct} className="neu-btn w-full py-2 text-sm accent-text">
                Save product
              </button>
            </div>
          )}

          {section === "stock" && (
            <div className="space-y-3">
              <select value={addStore} onChange={(e) => setAddStore(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm">
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" />
              <button type="button" onClick={addStock} className="neu-btn w-full py-2 text-sm accent-text">
                Add units to store
              </button>
              <hr className="border-[var(--shadow-dark)]/20" />
              <p className="text-xs text-[var(--muted)]">Add a new size (jackets, shoes, etc.)</p>
              <input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="Size e.g. M, 42" className="neu-inset w-full px-3 py-2 text-sm" />
              <input type="number" min={0} value={newVariantQty} onChange={(e) => setNewVariantQty(Number(e.target.value))} placeholder="Initial stock" className="neu-inset w-full px-3 py-2 text-sm" />
              <button type="button" onClick={addVariantSize} className="neu-btn w-full py-2 text-sm accent-text">
                Add size &amp; stock
              </button>
            </div>
          )}

          {section === "transfer" && (
            <div className="space-y-3">
              <label className="text-xs text-[var(--muted)]">From store</label>
              <select value={fromStore} onChange={(e) => setFromStore(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm">
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <label className="text-xs text-[var(--muted)]">To store</label>
              <select value={toStore} onChange={(e) => setToStore(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm">
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="number" min={1} value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" />
              <button type="button" onClick={transferStock} className="neu-btn w-full py-2 text-sm accent-text">
                Move stock
              </button>
            </div>
          )}

          {msg && <p className="mt-4 text-xs text-[var(--muted)]">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
