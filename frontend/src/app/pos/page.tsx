"use client";

import { useEffect, useState } from "react";
import { PosView } from "@/components/PosViews";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/auth";
import { FALLBACK_CATEGORIES, type Category } from "@/lib/catalog";

export default function PosPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => setCategories(d.categories ?? FALLBACK_CATEGORIES))
      .catch(() => setCategories(FALLBACK_CATEGORIES));
  }, []);

  return (
    <RequireAuth>
      {!categories ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="neu-flat px-8 py-6 text-sm text-[var(--muted)]">Loading…</div>
        </div>
      ) : (
        <PosView categories={categories} />
      )}
    </RequireAuth>
  );
}
