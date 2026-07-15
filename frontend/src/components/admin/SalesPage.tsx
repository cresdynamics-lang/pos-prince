"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";
import { apiFetch, getUser, isStaffUser } from "@/lib/auth";
import { useStore, useStoreApiPath } from "@/lib/store-context";

type Sale = {
  id: string;
  order_id?: string | null;
  product: string;
  variant_label: string;
  shop: string;
  store_name: string;
  inventory_shop: string;
  cashier: string;
  quantity: number;
  list_price: number;
  sale_price: number;
  discount_amount: number;
  overall_discount: number;
  total: number;
  payment_method: string;
  transaction_time: string;
};

export function SalesPageClient() {
  const { isAllStores, selectedStore } = useStore();
  const apiPath = useStoreApiPath("/sales");
  const [sales, setSales] = useState<Sale[]>([]);

  const me = getUser();
  const staffView = isStaffUser(me);

  const loadSales = useCallback(() => {
    apiFetch<{ sales: Sale[] }>(apiPath)
      .then((d) => setSales(d.sales ?? []))
      .catch(() => setSales([]));
  }, [apiPath]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const todaySales = sales.filter((s) => {
    const d = new Date(s.transaction_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const displaySales = staffView ? todaySales : sales;

  return (
    <div className="space-y-4">
      <StoreScopeBanner
        hint={
          staffView
            ? "Your personal sales for today at your assigned store."
            : isAllStores
              ? "Sales across all stores. Pick a store in the header to see one location only."
              : `Sales recorded at ${selectedStore?.name ?? "this store"}.`
        }
      />

      <div className="neu-flat flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-[var(--muted)]">
          {staffView
            ? "Your sales history for today. Record new sales in POS."
            : isAllStores
              ? "Sales history across all stores. New sales are recorded in POS."
              : `Sales at ${selectedStore?.name ?? "selected store"}. New sales are recorded in POS.`}
        </p>
        <Link href="/pos" className="neu-btn px-4 py-2 text-sm accent-text">
          Open POS
        </Link>
      </div>

      <div className="neu-flat overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Product</th>
              {!staffView && isAllStores && <th className="px-4 py-3">Store</th>}
              {!staffView && <th className="px-4 py-3">Cashier</th>}
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {displaySales.map((s) => {
              const lineDisc = s.discount_amount ?? Math.max(0, (s.list_price - s.sale_price) * s.quantity);
              return (
              <tr key={s.id} className="border-b border-[var(--shadow-dark)]/20">
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {new Date(s.transaction_time).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {s.product}
                  <span className="block text-xs text-[var(--muted)]">{s.variant_label}</span>
                </td>
                {!staffView && isAllStores && (
                  <td className="px-4 py-3">{s.store_name || s.shop}</td>
                )}
                {!staffView && <td className="px-4 py-3 accent-text">{s.cashier}</td>}
                <td className="px-4 py-3">{s.quantity}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">KES {s.sale_price.toLocaleString()}</span>
                  {lineDisc > 0 && (
                    <span className="ml-1 text-[10px] text-[var(--muted)] line-through">
                      {s.list_price.toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lineDisc > 0 ? (
                    <span className="text-red-700">−KES {lineDisc.toLocaleString()}</span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                  {(s.overall_discount ?? 0) > 0 && (
                    <span className="block text-[10px] text-[var(--muted)]">
                      order −KES {s.overall_discount.toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium accent-text">KES {s.total.toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{s.payment_method}</td>
              </tr>
              );
            })}
            {displaySales.length === 0 && (
              <tr>
                <td
                  colSpan={staffView ? 7 : isAllStores ? 9 : 8}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  {staffView ? "No sales today yet." : "No sales found for this view."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
