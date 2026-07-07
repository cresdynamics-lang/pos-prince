"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CategoryPieChart,
  EMPTY_DASHBOARD,
  RevenueLineChart,
  SummaryCards,
  TopProductsBar,
  type DashboardData,
} from "@/components/DashboardCharts";
import { ExpenseSidePanel } from "@/components/admin/ExpenseSidePanel";
import { GrandTotalByStore } from "@/components/admin/GrandTotalByStore";
import { StaffTodaySales, type TodaySaleRow } from "@/components/admin/StaffTodaySales";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";
import { apiFetch, getUser, isDirector, isStaffUser } from "@/lib/auth";
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

type DashboardResponse = DashboardData & {
  by_store?: StoreToday[];
  today_sales?: TodaySaleRow[];
  personal_view?: boolean;
};

export function DashboardPageClient() {
  const { isAllStores, selectedStore } = useStore();
  const apiPath = useStoreApiPath("/analytics/dashboard");
  const [data, setData] = useState<DashboardResponse>(EMPTY_DASHBOARD);
  const staffView = isStaffUser(getUser());

  const loadDashboard = useCallback(() => {
    apiFetch<DashboardResponse>(apiPath).then(setData).catch(() => setData(EMPTY_DASHBOARD));
  }, [apiPath]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <StoreScopeBanner
          hint={
            staffView
              ? "Your personal sales today — no company finances or revenue totals."
              : isAllStores
                ? "Combined totals across all stores. Pick a store in the header for one location."
                : `Figures for ${selectedStore?.name ?? "selected store"} only.`
          }
        />

        {staffView && (
          <p className="text-sm text-[var(--muted)]">
            Your sales today — products sold and transactions you recorded in POS.
          </p>
        )}

        <SummaryCards summary={data.summary} variant={staffView ? "staff" : "director"} />

        {staffView ? (
          <>
            <StaffTodaySales sales={data.today_sales ?? []} />
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

      {isDirector(getUser()) && <ExpenseSidePanel onRecorded={loadDashboard} />}
    </div>
  );
}
