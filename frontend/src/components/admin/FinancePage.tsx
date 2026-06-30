"use client";

import { useCallback, useEffect, useState } from "react";
import { ExpenseSidePanel } from "@/components/admin/ExpenseSidePanel";
import { GrandTotalByStore } from "@/components/admin/GrandTotalByStore";
import { apiFetch } from "@/lib/auth";
import { useStore, useStoreApiPath } from "@/lib/store-context";

type PaymentTotal = { method: string; label: string; amount: number };
type CategoryTotal = { category: string; amount: number };
type StoreToday = {
  store_id: string;
  store_name: string;
  sales_today: number;
  revenue_today: number;
  profit_today: number;
  units_sold: number;
  expenses_today: number;
  net_today: number;
};

type FinanceData = {
  revenue_today: number;
  revenue_month: number;
  expenses_today: number;
  expenses_month: number;
  net_today: number;
  net_month: number;
  by_payment_today: PaymentTotal[];
  by_payment_month: PaymentTotal[];
  expenses_by_category: CategoryTotal[];
  by_store_today?: StoreToday[];
};

export function FinancePageClient() {
  const { isAllStores } = useStore();
  const apiPath = useStoreApiPath("/finance/overview");
  const [finance, setFinance] = useState<FinanceData | null>(null);

  const load = useCallback(() => {
    apiFetch<FinanceData>(apiPath).then(setFinance).catch(() => setFinance(null));
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <section className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="neu-flat p-5">
            <p className="text-xs text-[var(--muted)]">Revenue today</p>
            <p className="mt-2 text-2xl font-semibold accent-text">
              KES {(finance?.revenue_today ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="neu-flat p-5">
            <p className="text-xs text-[var(--muted)]">Expenses today</p>
            <p className="mt-2 text-2xl font-semibold text-red-700">
              KES {(finance?.expenses_today ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="neu-flat p-5">
            <p className="text-xs text-[var(--muted)]">Net today</p>
            <p className="mt-2 text-2xl font-semibold">
              KES {(finance?.net_today ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="neu-flat p-5">
            <p className="text-xs text-[var(--muted)]">Net this month</p>
            <p className="mt-2 text-2xl font-semibold accent-text">
              KES {(finance?.net_month ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="neu-flat p-5">
            <h3 className="mb-4 text-sm font-semibold">Sales by payment — today</h3>
            <div className="space-y-3">
              {(finance?.by_payment_today ?? []).length === 0 && (
                <p className="text-sm text-[var(--muted)]">No sales recorded today.</p>
              )}
              {(finance?.by_payment_today ?? []).map((p) => (
                <div key={p.method} className="flex justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="font-medium">KES {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="neu-flat p-5">
            <h3 className="mb-4 text-sm font-semibold">Sales by payment — this month</h3>
            <div className="space-y-3">
              {(finance?.by_payment_month ?? []).length === 0 && (
                <p className="text-sm text-[var(--muted)]">No sales this month yet.</p>
              )}
              {(finance?.by_payment_month ?? []).map((p) => (
                <div key={p.method} className="flex justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="font-medium">KES {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="neu-flat overflow-x-auto">
          <h3 className="border-b border-[var(--shadow-dark)]/30 px-4 py-3 text-sm font-semibold">
            Expenses by category (this month)
          </h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-[var(--muted)]">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(finance?.expenses_by_category ?? []).map((c) => (
                <tr key={c.category} className="border-t border-[var(--shadow-dark)]/20">
                  <td className="px-4 py-3 capitalize">{c.category}</td>
                  <td className="px-4 py-3 text-red-700">KES {c.amount.toLocaleString()}</td>
                </tr>
              ))}
              {(finance?.expenses_by_category ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-[var(--muted)]">
                    No expenses recorded this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isAllStores && finance?.by_store_today && finance.by_store_today.length > 0 && (
          <GrandTotalByStore rows={finance.by_store_today} />
        )}
      </section>

      <ExpenseSidePanel onRecorded={load} />
    </div>
  );
}
