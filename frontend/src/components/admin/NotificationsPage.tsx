"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_DASHBOARD,
  SummaryCards,
  TopProductsBar,
  type DashboardData,
} from "@/components/DashboardCharts";
import { GrandTotalByStore } from "@/components/admin/GrandTotalByStore";
import { apiFetch } from "@/lib/auth";
import { useStore, useStoreApiPath } from "@/lib/store-context";

type ActivityRow = {
  id: string;
  shop_name?: string | null;
  user_name?: string | null;
  action: string;
  summary: string;
  created_at: string;
};

type SaleRow = {
  id: string;
  product: string;
  variant_label: string;
  store_name: string;
  cashier: string;
  quantity: number;
  total: number;
  payment_method: string;
  transaction_time: string;
};

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

function actionLabel(action: string) {
  if (action.startsWith("sale")) return "Sale";
  if (action.startsWith("transfer")) return "Stock moved";
  if (action.startsWith("inventory")) return "Stock in";
  if (action.startsWith("expense")) return "Expense";
  if (action.startsWith("product")) return "Product";
  return action;
}

function actionTone(action: string) {
  if (action.startsWith("sale")) return "text-emerald-800 bg-emerald-100";
  if (action.startsWith("transfer")) return "text-amber-900 bg-amber-100";
  if (action.startsWith("inventory")) return "text-sky-900 bg-sky-100";
  return "text-[var(--muted)] bg-[var(--shadow-dark)]/10";
}

export function NotificationsPageClient() {
  const { isAllStores } = useStore();
  const dashPath = useStoreApiPath("/analytics/dashboard");
  const activityPath = useStoreApiPath("/activity");
  const salesPath = useStoreApiPath("/sales");

  const [dashboard, setDashboard] = useState<DashboardData & { by_store?: StoreToday[] }>(EMPTY_DASHBOARD);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<typeof dashboard>(dashPath).catch(() => EMPTY_DASHBOARD),
      apiFetch<{ activity: ActivityRow[] }>(`${activityPath}?limit=80`).catch(() => ({ activity: [] })),
      apiFetch<{ sales: SaleRow[] }>(salesPath).catch(() => ({ sales: [] })),
    ])
      .then(([d, a, s]) => {
        setDashboard(d);
        setActivity(a.activity ?? []);
        setSales((s.sales ?? []).slice(0, 15));
      })
      .finally(() => setLoading(false));
  }, [dashPath, activityPath, salesPath]);

  useEffect(() => {
    load();
  }, [load]);

  const stockEvents = useMemo(
    () => activity.filter((a) => a.action.startsWith("transfer") || a.action.startsWith("inventory")),
    [activity],
  );
  const saleEvents = useMemo(() => activity.filter((a) => a.action.startsWith("sale")), [activity]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Business pulse — what happened today across your stores: sales, stock movement, and performance.
      </p>

      <SummaryCards summary={dashboard.summary} variant="director" />

      {isAllStores && dashboard.by_store && dashboard.by_store.length > 0 && (
        <GrandTotalByStore rows={dashboard.by_store} />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <TopProductsBar data={dashboard.top_products} />

        <div className="neu-flat overflow-hidden">
          <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
            Latest sales
          </h3>
          <div className="max-h-[320px] overflow-y-auto">
            {sales.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No recent sales.</p>
            )}
            {sales.map((s) => (
              <div key={s.id} className="border-b border-[var(--shadow-dark)]/15 px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{s.product}</span>
                  <span className="accent-text">KES {s.total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {s.variant_label} · {s.store_name} · {s.cashier} · {s.quantity}× ·{" "}
                  {new Date(s.transaction_time).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="neu-flat overflow-hidden">
          <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
            Stock going out / moving
          </h3>
          <div className="max-h-[360px] overflow-y-auto">
            {stockEvents.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No stock movements logged yet.</p>
            )}
            {stockEvents.map((r) => (
              <div key={r.id} className="border-b border-[var(--shadow-dark)]/15 px-4 py-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${actionTone(r.action)}`}>
                    {actionLabel(r.action)}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p>{r.summary}</p>
                <p className="text-xs text-[var(--muted)]">
                  {r.user_name ?? "System"} · {r.shop_name ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="neu-flat overflow-hidden">
          <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
            Everything that happened
          </h3>
          <div className="max-h-[360px] overflow-y-auto">
            {activity.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No notifications yet.</p>
            )}
            {activity.map((r) => (
              <div key={r.id} className="border-b border-[var(--shadow-dark)]/15 px-4 py-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${actionTone(r.action)}`}>
                    {actionLabel(r.action)}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p>{r.summary}</p>
                <p className="text-xs text-[var(--muted)]">
                  {r.user_name ?? "—"} · {r.shop_name ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {saleEvents.length > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {saleEvents.length} sale-related event(s) in the activity log today.
        </p>
      )}
    </div>
  );
}
