"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CategoryPieChart,
  DEMO_DASHBOARD,
  RevenueLineChart,
  SummaryCards,
  TopProductsBar,
  type DashboardData,
} from "@/components/DashboardCharts";
import { ExpenseSidePanel } from "@/components/admin/ExpenseSidePanel";
import { GrandTotalByStore } from "@/components/admin/GrandTotalByStore";
import { apiFetch, getUser, isStaffUser } from "@/lib/auth";
import { useStore, useStoreApiPath } from "@/lib/store-context";

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

type DashboardResponse = DashboardData & { by_store?: StoreToday[] };

export function DashboardPageClient() {
  const { isAllStores, selectedStore } = useStore();
  const apiPath = useStoreApiPath("/analytics/dashboard");
  const [data, setData] = useState<DashboardResponse>(DEMO_DASHBOARD);
  const staffView = isStaffUser(getUser());

  const loadDashboard = useCallback(() => {
    apiFetch<DashboardResponse>(apiPath).then(setData).catch(() => setData(DEMO_DASHBOARD));
  }, [apiPath]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        {staffView && selectedStore && (
          <p className="text-sm text-[var(--muted)]">
            Today&apos;s sales at <strong className="accent-text">{selectedStore.name}</strong> — units and orders
            only.
          </p>
        )}

        <SummaryCards summary={data.summary} variant={staffView ? "staff" : "director"} />

        {staffView ? (
          <>
            <TopProductsBar data={data.top_products} />
            <CategoryPieChart data={data.sales_by_category} hideAmounts />
          </>
        ) : (
          <>
            <RevenueLineChart data={data.revenue_trend} />
            <div className="grid gap-6 lg:grid-cols-2">
              <CategoryPieChart data={data.sales_by_category} />
              <TopProductsBar data={data.top_products} />
            </div>
            {isAllStores && data.by_store && data.by_store.length > 0 && (
              <GrandTotalByStore rows={data.by_store} />
            )}
          </>
        )}
      </div>

      <ExpenseSidePanel onRecorded={loadDashboard} />
    </div>
  );
}
