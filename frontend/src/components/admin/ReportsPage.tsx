"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";
import { apiFetch, getUser, isDirector } from "@/lib/auth";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useStore, useStoreApiPath } from "@/lib/store-context";

type ReportSummary = {
  orders: number;
  units_sold: number;
  gross_revenue: number;
  discount_total: number;
  net_revenue: number;
  opening_units: number;
  closing_units: number;
  live_on_hand?: number | null;
  products_moved: number;
};

type ReportSale = {
  id: string;
  product: string;
  variant_label: string;
  shop_name: string;
  cashier: string;
  quantity: number;
  list_price: number;
  sale_price: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  transaction_time: string;
};

type ReportStock = {
  product_variant_id: string;
  product: string;
  variant_label: string;
  shop_id: string;
  shop_name: string;
  sku: string;
  opening_stock: number;
  units_sold: number;
  units_transferred_in: number;
  units_transferred_out: number;
  closing_stock: number;
  live_quantity?: number | null;
};

type DayReport = {
  date: string;
  is_today: boolean;
  summary: ReportSummary;
  sales: ReportSale[];
  stock: ReportStock[];
  history_dates: string[];
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtKes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export function ReportsPageClient() {
  const user = getUser();
  const director = isDirector(user);
  const { isAllStores, selectedStore } = useStore();
  const [date, setDate] = useState(todayISO);
  const basePath = useStoreApiPath("/reports/day");
  const apiPath = useMemo(() => {
    const sep = basePath.includes("?") ? "&" : "?";
    return `${basePath}${sep}date=${encodeURIComponent(date)}`;
  }, [basePath, date]);

  const [data, setData] = useState<DayReport | null>(null);
  const [err, setErr] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!director) return;
    apiFetch<DayReport>(apiPath)
      .then((d) => {
        setData(d);
        setErr("");
        setUpdatedAt(new Date());
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "Failed to load report");
        setData(null);
      });
  }, [apiPath, director]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh while viewing today
  useEffect(() => {
    if (!director || date !== todayISO()) return;
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [director, date, load]);

  if (!director) {
    return (
      <div className="neu-flat p-6 text-sm text-[var(--muted)]">
        Reports are available to directors only.
      </div>
    );
  }

  const s = data?.summary;
  const storeLabel = isAllStores ? "all-stores" : selectedStore?.name?.replace(/\s+/g, "-") ?? "store";

  function downloadSales() {
    if (!data) return;
    const headers = [
      "Time",
      "Store",
      "Product",
      "Variant",
      "Qty",
      "List price",
      "Sale price",
      "Discount",
      "Net",
      "Payment",
      "Cashier",
    ];
    const rows = data.sales.map((r) => [
      new Date(r.transaction_time).toLocaleString(),
      r.shop_name,
      r.product,
      r.variant_label,
      r.quantity,
      r.list_price,
      r.sale_price,
      r.discount_amount,
      r.total,
      r.payment_method,
      r.cashier,
    ]);
    downloadCsv(`sales-${date}-${storeLabel}.csv`, rowsToCsv(headers, rows));
  }

  function downloadRevenue() {
    if (!data?.summary) return;
    const sum = data.summary;
    const headers = ["Date", "Store scope", "Orders", "Units sold", "Gross revenue", "Discounts", "Net revenue"];
    const rows = [
      [
        date,
        isAllStores ? "All stores" : selectedStore?.name ?? "",
        sum.orders,
        sum.units_sold,
        sum.gross_revenue,
        sum.discount_total,
        sum.net_revenue,
      ],
    ];
    // Also include line-level net rollup from sales for audit
    const saleHeaders = ["Product", "Qty", "Net", "Discount"];
    const saleRows = data.sales.map((r) => [r.product, r.quantity, r.total, r.discount_amount]);
    const csv =
      rowsToCsv(headers, rows) +
      "\n\n" +
      rowsToCsv(saleHeaders, saleRows);
    downloadCsv(`revenue-${date}-${storeLabel}.csv`, csv);
  }

  function downloadStock() {
    if (!data) return;
    const headers = [
      "Store",
      "Product",
      "Variant",
      "SKU",
      "Opening",
      "Sold",
      "Transfer in",
      "Transfer out",
      "Closing",
      "Live on hand",
    ];
    const rows = data.stock.map((r) => [
      r.shop_name,
      r.product,
      r.variant_label,
      r.sku,
      r.opening_stock,
      r.units_sold,
      r.units_transferred_in,
      r.units_transferred_out,
      r.closing_stock,
      r.live_quantity ?? "",
    ]);
    downloadCsv(`stock-${date}-${storeLabel}.csv`, rowsToCsv(headers, rows));
  }

  return (
    <div className="space-y-6">
      <StoreScopeBanner
        hint={
          isAllStores
            ? "Day reports across all stores. Pick a store in the header to filter one location."
            : `Day report for ${selectedStore?.name ?? "this store"}.`
        }
      />

      <div className="neu-flat flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold accent-text">Daily reports</h2>
          <p className="text-xs text-[var(--muted)]">
            Sales made, products sold, and stock (opening − sold → closing). History kept per day.
            Download CSV for sales and revenue anytime.
            {data?.is_today && (
              <span className="ml-1 accent-text">
                Live · refreshes every 20s
                {updatedAt ? ` · ${updatedAt.toLocaleTimeString()}` : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--muted)]">
            Date
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="neu-inset ml-2 px-3 py-2 text-sm"
            />
          </label>
          <button type="button" onClick={load} className="neu-btn px-3 py-2 text-xs accent-text">
            Refresh
          </button>
          <button
            type="button"
            onClick={downloadSales}
            disabled={!data?.sales?.length}
            className="neu-btn px-3 py-2 text-xs accent-text disabled:opacity-40"
          >
            Download sales
          </button>
          <button
            type="button"
            onClick={downloadRevenue}
            disabled={!data?.summary}
            className="neu-btn px-3 py-2 text-xs accent-text disabled:opacity-40"
          >
            Download revenue
          </button>
          <button
            type="button"
            onClick={downloadStock}
            disabled={!data?.stock?.length}
            className="neu-btn px-3 py-2 text-xs disabled:opacity-40"
          >
            Download stock
          </button>
          <Link href="/admin/inventory" className="neu-btn px-3 py-2 text-xs">
            Update stock
          </Link>
        </div>
      </div>

      {(data?.history_dates?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data?.history_dates ?? []).slice(0, 14).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`neu-btn px-2.5 py-1 text-[11px] ${d === date ? "active accent-text" : ""}`}
            >
              {d === todayISO() ? "Today" : d}
            </button>
          ))}
        </div>
      )}

      {err && <p className="text-sm text-red-700">{err}</p>}

      {s && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="neu-flat p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Net sales</p>
            <p className="mt-1 text-xl font-semibold accent-text">{fmtKes(s.net_revenue)}</p>
            <p className="text-[10px] text-[var(--muted)]">
              {s.orders} orders · −{fmtKes(s.discount_total)} discounts
            </p>
          </div>
          <div className="neu-flat p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Products sold</p>
            <p className="mt-1 text-xl font-semibold accent-text">{s.units_sold}</p>
            <p className="text-[10px] text-[var(--muted)]">units deducted from stock</p>
          </div>
          <div className="neu-flat p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Opening → closing</p>
            <p className="mt-1 text-xl font-semibold">
              {s.opening_units} → {s.closing_units}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {s.live_on_hand != null ? `Live on hand ${s.live_on_hand}` : "end-of-day totals"}
            </p>
          </div>
          <div className="neu-flat p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Stock lines moved</p>
            <p className="mt-1 text-xl font-semibold accent-text">{s.products_moved}</p>
            <p className="text-[10px] text-[var(--muted)]">products with sales or adjustments</p>
          </div>
        </div>
      )}

      <div className="neu-flat overflow-x-auto">
        <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
          Stock per day (opening − sold)
        </h3>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--muted)]">
              {isAllStores && <th className="px-3 py-3">Store</th>}
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Opening</th>
              <th className="px-3 py-3">Sold</th>
              <th className="px-3 py-3">In / Out</th>
              <th className="px-3 py-3">Closing</th>
              {data?.is_today && <th className="px-3 py-3">Live</th>}
            </tr>
          </thead>
          <tbody>
            {(data?.stock ?? []).map((r) => (
              <tr key={`${r.shop_id}-${r.product_variant_id}`} className="border-t border-[var(--shadow-dark)]/20">
                {isAllStores && <td className="px-3 py-2 text-[var(--muted)]">{r.shop_name}</td>}
                <td className="px-3 py-2">
                  {r.product}
                  <span className="block text-xs text-[var(--muted)]">{r.variant_label || r.sku}</span>
                </td>
                <td className="px-3 py-2">{r.opening_stock}</td>
                <td className="px-3 py-2 font-medium text-red-700">
                  {r.units_sold > 0 ? `−${r.units_sold}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--muted)]">
                  +{r.units_transferred_in} / −{r.units_transferred_out}
                </td>
                <td className="px-3 py-2 font-medium">{r.closing_stock}</td>
                {data?.is_today && (
                  <td className="px-3 py-2 accent-text">{r.live_quantity ?? "—"}</td>
                )}
              </tr>
            ))}
            {(data?.stock?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={isAllStores ? 7 : 6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No stock movement recorded for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="neu-flat overflow-x-auto">
        <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
          Sales made
        </h3>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--muted)]">
              <th className="px-3 py-3">Time</th>
              {isAllStores && <th className="px-3 py-3">Store</th>}
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Net</th>
              <th className="px-3 py-3">Cashier</th>
            </tr>
          </thead>
          <tbody>
            {(data?.sales ?? []).map((r) => (
              <tr key={r.id} className="border-t border-[var(--shadow-dark)]/20">
                <td className="px-3 py-2 text-xs text-[var(--muted)]">
                  {new Date(r.transaction_time).toLocaleString()}
                </td>
                {isAllStores && <td className="px-3 py-2">{r.shop_name}</td>}
                <td className="px-3 py-2">
                  {r.product}
                  <span className="block text-xs text-[var(--muted)]">{r.variant_label}</span>
                  {r.discount_amount > 0 && (
                    <span className="block text-[10px] text-red-700">
                      −KES {r.discount_amount.toLocaleString()} disc
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{r.quantity}</td>
                <td className="px-3 py-2 font-medium accent-text">{fmtKes(r.total)}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{r.cashier}</td>
              </tr>
            ))}
            {(data?.sales?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={isAllStores ? 6 : 5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No sales for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Inventory can still be updated on{" "}
        <Link href="/admin/inventory" className="accent-text underline">
          Inventory → Stock
        </Link>
        : pick a store, edit On hand inline or open a row to set / add / transfer. Sales deduct sold
        units from opening; reports keep that day&apos;s history.
      </p>
    </div>
  );
}
