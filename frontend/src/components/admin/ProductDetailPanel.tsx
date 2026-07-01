"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCategoryOptions } from "@/components/admin/CategoryCrudPanel";
import type { Category } from "@/lib/catalog";
import { apiFetch, getUser, hasPermission, PERMS } from "@/lib/auth";

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
};

export function ProductDetailPanel({
  variantId,
  shops,
  categories,
  onClose,
  onUpdated,
  canEditInventory = true,
}: Props) {
  const me = getUser();
  const canRecordSale = hasPermission(me, PERMS.salesCreate);
  const tabs = useMemo(
    () =>
      [
        { id: "details" as const, label: "Details", show: canEditInventory },
        { id: "stock" as const, label: "Add stock", show: canEditInventory },
        { id: "transfer" as const, label: "Move stock", show: canEditInventory },
        { id: "sale" as const, label: "Sale", show: canRecordSale },
      ].filter((t) => t.show),
    [canEditInventory, canRecordSale],
  );
  const categoryOptions = useCategoryOptions(categories);
  const [variant, setVariant] = useState<VariantDetail | null>(null);
  const [stores, setStores] = useState<StoreStock[]>([]);
  const [section, setSection] = useState<"details" | "stock" | "transfer" | "sale">("details");
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
  const [saleStore, setSaleStore] = useState("");
  const [salePrice, setSalePrice] = useState(0);
  const [saleQty, setSaleQty] = useState(1);
  const [payment, setPayment] = useState("cash");

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
        setSalePrice(d.variant.base_price);
        if (d.stores?.[0]) {
          setAddStore(d.stores[0].store_id);
          setFromStore(d.stores[0].store_id);
          setSaleStore(d.stores[0].store_id);
        }
        if (d.stores?.[1]) setToStore(d.stores[1].store_id);
      })
      .catch(() => setMsg("Could not load product"));
  }, [variantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === section)) {
      setSection(tabs[0].id);
    }
  }, [section, tabs]);

  const discountPreview = Math.max(0, (basePrice - salePrice) * saleQty);

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

  async function recordSale() {
    setMsg("");
    try {
      const res = await apiFetch<{ discount_amount: number; net_revenue: number }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          shop_id: saleStore,
          product_variant_id: variantId,
          quantity: saleQty,
          sale_price: salePrice,
          payment_method: payment,
        }),
      });
      setMsg(`Sale recorded — net KES ${res.net_revenue?.toLocaleString() ?? 0}`);
      load();
      onUpdated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sale failed");
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
              <div key={s.store_id} className="flex justify-between border-b border-[var(--shadow-dark)]/20 py-2 text-sm last:border-0">
                <span>{s.store_name}</span>
                <span>
                  Open <strong>{s.opening_stock}</strong> · Sold {s.units_sold_today} · Close{" "}
                  <strong className="accent-text">{s.closing_stock}</strong>
                </span>
              </div>
            ))}
          </div>

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
                Add to store inventory
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

          {section === "sale" && (
            <div className="space-y-3">
              <select value={saleStore} onChange={(e) => setSaleStore(e.target.value)} className="neu-inset w-full px-3 py-2 text-sm">
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)]">List: KES {basePrice.toLocaleString()}</p>
              <input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" placeholder="Sale price" />
              <input type="number" min={1} value={saleQty} onChange={(e) => setSaleQty(Number(e.target.value))} className="neu-inset w-full px-3 py-2 text-sm" />
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
              {discountPreview > 0 && (
                <p className="text-xs accent-text">Discount: KES {discountPreview.toLocaleString()}</p>
              )}
              <button type="button" onClick={recordSale} className="neu-btn w-full py-2 text-sm accent-text">
                Record sale
              </button>
            </div>
          )}

          {msg && <p className="mt-4 text-xs text-[var(--muted)]">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
