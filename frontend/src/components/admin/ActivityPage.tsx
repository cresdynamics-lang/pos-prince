"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth";
import { useStoreApiPath } from "@/lib/store-context";

type ActivityRow = {
  id: string;
  shop_name?: string | null;
  user_name?: string | null;
  action: string;
  summary: string;
  created_at: string;
};

export function ActivityPageClient() {
  const apiPath = useStoreApiPath("/activity");
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ activity: ActivityRow[] }>(`${apiPath}?limit=100`)
      .then((d) => setRows(d.activity ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Real-time log of sales, stock changes, pricing updates, expenses, and transfers — only actions recorded after this update appear here.
      </p>

      <div className="neu-flat overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--shadow-dark)]/20">
                <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{r.user_name ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{r.shop_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--shadow-dark)]/10 px-2 py-0.5 text-xs">{r.action}</span>
                </td>
                <td className="px-4 py-3">{r.summary}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  No activity yet. Record a sale, add stock, or update a product price to see entries here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
