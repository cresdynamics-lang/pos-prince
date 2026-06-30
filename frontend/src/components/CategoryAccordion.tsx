"use client";

import { useState } from "react";
import type { Category } from "@/lib/api";

type Props = {
  categories: Category[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
};

export function CategoryAccordion({ categories, selectedSlug, onSelect }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const hasChildren = (cat.children?.length ?? 0) > 0;
        const isOpen = open[cat.slug] ?? false;

        return (
          <div key={cat.slug} className="neu-flat overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
              onClick={() => {
                if (hasChildren) setOpen((o) => ({ ...o, [cat.slug]: !isOpen }));
                else onSelect(cat.slug);
              }}
            >
              <span className={selectedSlug === cat.slug ? "accent-text" : ""}>{cat.name}</span>
              {hasChildren && <span className="text-[var(--muted)]">{isOpen ? "−" : "+"}</span>}
            </button>
            {hasChildren && isOpen && (
              <div className="border-t border-[var(--shadow-dark)]/30 px-2 pb-2">
                {cat.children!.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => onSelect(sub.slug)}
                    className={`neu-btn mt-2 w-full px-3 py-2 text-left text-xs ${
                      selectedSlug === sub.slug ? "active accent-text" : "text-[var(--muted)]"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
