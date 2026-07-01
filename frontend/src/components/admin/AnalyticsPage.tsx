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

type AnalyticsResponse = DashboardData & { by_store?: StoreToday[] };

export function AnalyticsPageClient() {
  const { isAllStores } = useStore();
  const apiPath = useStoreApiPath("/analytics/dashboard");
  const [data, setData] = useState<AnalyticsResponse>(EMPTY_DASHBOARD);
  const staffView = isStaffUser(getUser());

  const load = useCallback(() => {
    apiFetch<AnalyticsResponse>(apiPath).then(setData).catch(() => {});
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        {staffView
          ? "Sales performance — units sold and moving products."
          : "Deep dive into store performance and category mix."}
      </p>
      <SummaryCards summary={data.summary} variant={staffView ? "staff" : "director"} />
      {staffView ? (
        <>
          <TopProductsBar data={data.top_products} />
          <CategoryPieChart data={data.sales_by_category} hideAmounts />
        </>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <RevenueLineChart data={data.revenue_trend} />
            <CategoryPieChart data={data.sales_by_category} />
          </div>
          <TopProductsBar data={data.top_products} />
          {isAllStores && data.by_store && data.by_store.length > 0 && (
            <GrandTotalByStore rows={data.by_store} />
          )}
        </>
      )}
    </div>
  );
}
