"use client";

import { useStore } from "@/lib/store-context";

type Props = {
  action?: string;
};

/** Shown when a store-specific action is attempted while "All stores" is selected. */
export function SelectStorePrompt({ action = "update inventory" }: Props) {
  const { stores } = useStore();

  return (
    <div className="neu-flat border-l-4 border-amber-600 px-6 py-8 text-center">
      <p className="text-lg font-semibold text-amber-900">Select a store first</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
        To {action}, choose a single store from the <strong>Store</strong> dropdown in the header
        above — not &ldquo;All stores&rdquo;.
      </p>
      {stores.length > 0 && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          Available: {stores.map((s) => s.name).join(" · ")}
        </p>
      )}
    </div>
  );
}
