"use client";

import { useStore } from "@/lib/store-context";

type Props = {
  hint?: string;
};

export function StoreScopeBanner({ hint }: Props) {
  const { selectedStore, isAllStores } = useStore();

  if (isAllStores) {
    return (
      <div className="neu-inset border-l-4 border-amber-600 px-4 py-3 text-sm">
        <p className="font-medium text-amber-800">All stores — grand total view</p>
        <p className="mt-1 text-[var(--muted)]">
          {hint ?? "Select a specific store in the header to see that shop’s sales, expenses, and bank reconciliation."}
        </p>
      </div>
    );
  }

  return (
    <div className="neu-inset border-l-4 border-[var(--accent)] px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Current store</p>
      <p className="mt-1 text-lg font-semibold accent-text">{selectedStore?.name ?? "Selected store"}</p>
      <p className="mt-1 text-[var(--muted)]">
        Figures below are for this store only — match sales and expenses to today’s bank account.
      </p>
    </div>
  );
}
