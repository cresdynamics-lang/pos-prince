"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/lib/catalog";
import { apiFetch } from "@/lib/auth";

const VARIANT_OPTIONS = ["size", "color", "material", "sleeve_type", "length"] as const;

type FlatCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  parent_name?: string;
  variant_types: string[];
};

function flattenCategories(categories: Category[], parentName = ""): FlatCategory[] {
  const out: FlatCategory[] = [];
  for (const cat of categories) {
    const types = Array.isArray(cat.variant_types) ? cat.variant_types : [];
    out.push({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parent_id: cat.parent_id,
      parent_name: parentName || undefined,
      variant_types: types,
    });
    if (cat.children?.length) {
      out.push(...flattenCategories(cat.children, cat.name));
    }
  }
  return out;
}

type Props = {
  categories: Category[];
  onChanged: () => void;
  canEdit?: boolean;
};

export function CategoryCrudPanel({ categories, onChanged, canEdit = true }: Props) {
  const flat = useMemo(() => flattenCategories(categories), [categories]);
  const parents = useMemo(() => flat.filter((c) => !c.parent_id), [flat]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [variantTypes, setVariantTypes] = useState<string[]>(["size", "color"]);
  const [msg, setMsg] = useState("");

  function resetForm() {
    setEditingId(null);
    setName("");
    setParentId("");
    setVariantTypes(["size", "color"]);
    setMsg("");
  }

  function startCreate() {
    resetForm();
  }

  function startEdit(cat: FlatCategory) {
    setEditingId(cat.id);
    setName(cat.name);
    setParentId(cat.parent_id ?? "");
    setVariantTypes(cat.variant_types.length ? cat.variant_types : ["size", "color"]);
    setMsg("");
  }

  function toggleVariant(v: string) {
    setVariantTypes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  async function save() {
    if (!name.trim()) {
      setMsg("Name is required");
      return;
    }
    setMsg("");
    try {
      const body = {
        name: name.trim(),
        parent_id: parentId || null,
        variant_types: variantTypes,
      };
      if (editingId) {
        await apiFetch(`/categories/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        setMsg("Category saved");
      } else {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(body) });
        setMsg("Category created");
        resetForm();
      }
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete category "${label}"?`)) return;
    setMsg("");
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      setMsg("Category deleted");
      if (editingId === id) resetForm();
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="neu-flat overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Variants</th>
              {canEdit && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {flat.map((cat) => (
              <tr
                key={cat.id}
                className={`border-b border-[var(--shadow-dark)]/20 ${
                  canEdit ? "cursor-pointer hover:opacity-80" : ""
                } ${editingId === cat.id ? "bg-[var(--shadow-dark)]/10" : ""}`}
                onClick={() => canEdit && startEdit(cat)}
              >
                <td className="px-4 py-3 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{cat.parent_name || "—"}</td>
                <td className="px-4 py-3 text-xs">{cat.variant_types.join(", ") || "—"}</td>
                {canEdit && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="neu-btn px-2 py-1 text-xs text-red-700"
                      onClick={() => remove(cat.id, cat.name)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <aside className="sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto neu-flat p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold accent-text">
            {editingId ? "Edit category" : "New category"}
          </h3>
          <button type="button" className="neu-btn px-2 py-1 text-xs" onClick={startCreate}>
            + New
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="neu-inset w-full px-3 py-2 text-sm"
          />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="neu-inset w-full px-3 py-2 text-sm"
          >
            <option value="">Top-level category (no parent)</option>
            {parents
              .filter((p) => p.id !== editingId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  Under {p.name}
                </option>
              ))}
          </select>
          <p className="text-[10px] text-[var(--muted)]">
            {parents.length} parent categories available. Pick one to create a subcategory products can use.
          </p>
          <div className="flex flex-wrap gap-2">
            {VARIANT_OPTIONS.map((v) => (
              <label key={v} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={variantTypes.includes(v)}
                  onChange={() => toggleVariant(v)}
                />
                {v.replace("_", " ")}
              </label>
            ))}
          </div>
          <button type="button" onClick={save} className="neu-btn w-full py-2 text-sm accent-text">
            {editingId ? "Save changes" : "Create category"}
          </button>
          {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
        </div>
      </aside>
      ) : (
        <p className="text-sm text-[var(--muted)]">View-only — you need inventory edit permission to manage categories.</p>
      )}
    </div>
  );
}

export function useCategoryOptions(categories: Category[]) {
  return useMemo(() => flattenCategories(categories), [categories]);
}

/** Leaf categories only — sellable subcategories that can hold one or more products. */
export function useSellableCategoryOptions(categories: Category[]) {
  const flat = useCategoryOptions(categories);
  return useMemo(() => {
    const parentIds = new Set(flat.filter((c) => c.parent_id).map((c) => c.parent_id!));
    return flat.filter((c) => !parentIds.has(c.id));
  }, [flat]);
}
