"use client";

import { useEffect, useState } from "react";
import { PosView } from "@/components/PosViews";
import { apiFetch } from "@/lib/auth";
import { getCachedCatalog } from "@/lib/offline";
import { FALLBACK_CATEGORIES, type Category } from "@/lib/catalog";

export default function PosPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    const cached = getCachedCatalog<Category[]>();
    if (cached?.length) setCategories(cached);

    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => setCategories(d.categories ?? FALLBACK_CATEGORIES))
      .catch(() => setCategories((prev) => prev ?? cached ?? FALLBACK_CATEGORIES));
  }, []);

  if (!categories) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="neu-flat px-8 py-6 text-sm text-[var(--muted)]">Loading POS…</div>
      </div>
    );
  }

  return <PosView categories={categories} />;
}
