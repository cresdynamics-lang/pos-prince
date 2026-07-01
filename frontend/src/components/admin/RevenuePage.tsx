"use client";

import { useCallback, useEffect, useState } from "react";
import { RevenueLineChart, EMPTY_DASHBOARD, SummaryCards, type DashboardData } from "@/components/DashboardCharts";
import { DailyNotesPanel } from "@/components/admin/DailyNotesPanel";
import { ExpenseSidePanel } from "@/components/admin/ExpenseSidePanel";
import { GrandTotalByStore } from "@/components/admin/GrandTotalByStore";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";
import { apiFetch } from "@/lib/auth";
import { useStore, useStoreApiPath } from "@/lib/store-context";

type StoreRevenue = {
  store_id: string;
  store_name: string;
  gross_revenue: number;
  discounts: number;
  net_revenue: number;
  units_sold: number;
};

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

type RevenueData = DashboardData & {
  monthly_total?: number;
  monthly_discount?: number;
  margin_pct?: number;
  by_store?: StoreRevenue[];
  expenses_today?: number;
  expenses_month?: number;
  net_today?: number;
  net_month?: number;
  expenses_by_category?: CategoryTotal[];
  by_store_today?: StoreToday[];
  summary: DashboardData["summary"] & {
    gross_revenue_today?: number;
    discount_today?: number;
  };
};

export function RevenuePageClient() {
  const { isAllStores, selectedStore } = useStore();
  const apiPath = useStoreApiPath("/analytics/revenue");
  const [data, setData] = useState<RevenueData>({
    ...EMPTY_DASHBOARD,
    monthly_total: 0,
    monthly_discount: 0,
    by_store: [],
    expenses_today: 0,
    expenses_month: 0,
    net_today: 0,
    net_month: 0,
    expenses_by_category: [],
  });

  const load = useCallback(() => {
    apiFetch<RevenueData>(apiPath).then(setData).catch(() => {});
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <StoreScopeBanner />

        {isAllStores ? (
          <>
            {data.by_store_today && data.by_store_today.length > 0 && (
              <GrandTotalByStore rows={data.by_store_today} />
            )}
            <div className="neu-flat overflow-x-auto">
              <h3 className="border-b border-[var(--shadow-dark)]/30 px-4 py-3 text-sm font-semibold">
                Revenue by store (this month)
              </h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-[var(--muted)]">
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Discounts</th>
                    <th className="px-4 py-3">Net revenue</th>
                    <th className="px-4 py-3">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.by_store ?? []).map((s) => (
                    <tr key={s.store_id} className="border-t border-[var(--shadow-dark)]/20">
                      <td className="px-4 py-3 font-medium">{s.store_name}</td>
                      <td className="px-4 py-3">KES {s.gross_revenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-700">-KES {s.discounts.toLocaleString()}</td>
                      <td className="px-4 py-3 accent-text">KES {s.net_revenue.toLocaleString()}</td>
                      <td className="px-4 py-3">{s.units_sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <SummaryCards summary={data.summary} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Revenue today — {selectedStore?.name}</p>
                <p className="mt-2 text-2xl font-semibold accent-text">
                  KES {(data.summary.revenue_today ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Expenses today</p>
                <p className="mt-2 text-2xl font-semibold text-red-700">
                  KES {(data.expenses_today ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Net today (bank check)</p>
                <p className="mt-2 text-2xl font-semibold">
                  KES {(data.net_today ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">Sales minus expenses</p>
              </div>
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Net this month</p>
                <p className="mt-2 text-2xl font-semibold accent-text">
                  KES {(data.net_month ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Monthly net revenue</p>
                <p className="mt-2 text-2xl font-semibold accent-text">
                  KES {(data.monthly_total ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Monthly expenses</p>
                <p className="mt-2 text-2xl font-semibold text-red-700">
                  KES {(data.expenses_month ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="neu-flat p-5">
                <p className="text-xs text-[var(--muted)]">Today&apos;s discounts</p>
                <p className="mt-2 text-2xl font-semibold text-red-700">
                  KES {(data.summary.discount_today ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="neu-flat overflow-x-auto">
              <h3 className="border-b border-[var(--shadow-dark)]/30 px-4 py-3 text-sm font-semibold">
                Expenses by category (this month) — {selectedStore?.name}
              </h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-[var(--muted)]">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.expenses_by_category ?? []).map((c) => (
                    <tr key={c.category} className="border-t border-[var(--shadow-dark)]/20">
                      <td className="px-4 py-3 capitalize">{c.category}</td>
                      <td className="px-4 py-3 text-red-700">KES {c.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {(data.expenses_by_category ?? []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-[var(--muted)]">
                        No expenses recorded this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <RevenueLineChart data={data.revenue_trend} />
            <DailyNotesPanel />
          </>
        )}
      </div>

      <ExpenseSidePanel onRecorded={load} />
    </div>
  );
}
