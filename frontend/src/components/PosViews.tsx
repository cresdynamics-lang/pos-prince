"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CategoryAccordion } from "@/components/CategoryAccordion";
import type { Category } from "@/lib/api";

export function PosView({ categories }: { categories: Category[] }) {
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);

  const activeParent = useMemo(
    () => categories.find((c) => c.slug === parentSlug) ?? null,
    [categories, parentSlug],
  );

  const activeSub = useMemo(() => {
    if (!activeParent?.children?.length) return null;
    return activeParent.children.find((c) => c.slug === subSlug) ?? null;
  }, [activeParent, subSlug]);

  const activeCategory = activeSub ?? activeParent;

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

          <div className="neu-inset mt-6 grid min-h-[280px] place-items-center p-8 text-center">
            {activeCategory ? (
              <div>
                <p className="text-lg font-semibold">{activeCategory.name}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Variants: {activeCategory.variant_types.join(" · ")}
                </p>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Product tiles load here once catalog Excel is imported.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Select a category to start a sale</p>
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
