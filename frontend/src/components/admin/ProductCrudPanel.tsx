"use client";

import { useCallback, useEffect, useState } from "react";
import { useCategoryOptions } from "@/components/admin/CategoryCrudPanel";
import type { Category } from "@/lib/catalog";
import { apiFetch } from "@/lib/auth";

type Product = {
  id: string;
  name: string;
  brand?: string | null;
  category_id: string;
  category_name: string;
  category_slug: string;
  base_price: number;
  cost_price: number;
  is_active: boolean;
  variant_count: number;
};

type Props = {
  categories: Category[];
  onChanged: () => void;
  onOpenVariant?: (variantId: string) => void;
};

export function ProductCrudPanel({ categories, onChanged, onOpenVariant }: Props) {
  const categoryOptions = useCategoryOptions(categories);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [colors, setColors] = useState("Black, White");
  const [initialStock, setInitialStock] = useState(0);

  const load = useCallback(() => {
    const params = new URLSearchParams({ active: "false" });
    if (categoryFilter) params.set("category_id", categoryFilter);
    apiFetch<{ products: Product[] }>(`/products?${params}`)
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]));
  }, [categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleProducts = showInactive ? products : products.filter((p) => p.is_active);

  function resetFields() {
    setName("");
    setCategoryId(categoryOptions.find((c) => c.parent_id)?.id ?? categoryOptions[0]?.id ?? "");
    setBrand("");
    setBasePrice(0);
    setCostPrice(0);
    setColors("Black, White");
    setInitialStock(0);
    setMsg("");
  }

  function closeForm() {
    setShowForm(false);
    setMsg("");
  }

  function startCreate() {
    resetFields();
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setSelectedId(p.id);
    openStock(p);
  }

  async function save() {
    if (!name.trim() || !categoryId) {
      setMsg("Name and category are required");
      return;
    }
    setMsg("");
    try {
      const colorList = colors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category_id: categoryId,
          brand,
          base_price: basePrice,
          cost_price: costPrice,
          colors: colorList.length ? colorList : ["Default"],
          initial_stock_per_store: initialStock,
        }),
      });
      setMsg("Product created");
      closeForm();
      resetFields();
      load();
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}" permanently?`)) return;
    setMsg("");
    try {
      await apiFetch(`/products/${p.id}`, { method: "DELETE" });
      closeForm();
      load();
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function deactivate(p: Product) {
    if (!confirm(`Deactivate "${p.name}"?`)) return;
    try {
      await apiFetch(`/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      load();
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Deactivate failed");
    }
  }

  async function openStock(p: Product) {
    if (!onOpenVariant) return;
    try {
      const d = await apiFetch<{ variants: { id: string; product: string }[] }>("/variants");
      const variant = (d.variants ?? []).find((v) => v.product === p.name);
      if (variant) onOpenVariant(variant.id);
      else setMsg("No variant found — check the Stock tab");
    } catch {
      setMsg("Could not open product stock");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="neu-inset px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>

        <div className="neu-flat overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-[var(--shadow-dark)]/20 ${
                    selectedId === p.id ? "bg-[var(--shadow-dark)]/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{p.category_name}</td>
                  <td className="px-4 py-3">KES {p.base_price.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={p.is_active ? "accent-text" : "text-red-700"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="neu-btn px-2 py-1 text-xs" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      {onOpenVariant && (
                        <button type="button" className="neu-btn px-2 py-1 text-xs" onClick={() => openStock(p)}>
                          Stock
                        </button>
                      )}
                      {p.is_active && (
                        <button type="button" className="neu-btn px-2 py-1 text-xs text-red-700" onClick={() => deactivate(p)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    No products. Click + New product to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {msg && !showForm && <p className="text-xs text-[var(--muted)]">{msg}</p>}
      </div>

      <aside className="sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto neu-flat p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold accent-text">Products</h3>
          <button type="button" className="neu-btn px-3 py-1.5 text-sm accent-text" onClick={startCreate}>
            + New product
          </button>
        </div>

        {!showForm ? (
          <p className="text-sm text-[var(--muted)]">
            Click <strong>+ New product</strong> to add a product. Use <strong>Edit</strong> or <strong>Stock</strong> on a row to update an existing product.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs font-medium text-[var(--muted)]">New product</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="neu-inset w-full px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                </option>
              ))}
            </select>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={basePrice || ""}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              placeholder="List price (KES)"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={costPrice || ""}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              placeholder="Cost price (KES)"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <input
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Colors (comma-separated)"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={initialStock || ""}
              onChange={(e) => setInitialStock(Number(e.target.value))}
              placeholder="Initial stock per store"
              className="neu-inset w-full px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={save} className="neu-btn flex-1 py-2 accent-text">
                Create product
              </button>
              <button type="button" onClick={closeForm} className="neu-btn px-3 py-2 text-sm">
                Cancel
              </button>
            </div>
            {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
