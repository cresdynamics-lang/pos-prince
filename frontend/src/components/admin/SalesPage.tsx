"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUser, isStaffUser } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

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

type Shop = { id: string; name: string };

export function SalesPageClient() {
  const { selectedStoreId, stores: contextStores } = useStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [storeFilter, setStoreFilter] = useState("");

  const me = getUser();
  const staffView = isStaffUser(me);

  const loadSales = useCallback(() => {
    const q = storeFilter ? `?shop_id=${storeFilter}` : "";
    apiFetch<{ sales: Sale[] }>(`/sales${q}`)
      .then((d) => setSales(d.sales ?? []))
      .catch(() => setSales([]));
  }, [storeFilter]);

  useEffect(() => {
    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => {
        const list = d.shops?.length ? d.shops : contextStores;
        setShops(list);
        if (selectedStoreId) setStoreFilter(selectedStoreId);
      })
      .catch(() => {});
  }, [selectedStoreId, contextStores]);

  useEffect(() => {
    if (selectedStoreId) setStoreFilter(selectedStoreId);
  }, [selectedStoreId]);

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
      <div className="neu-flat flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-[var(--muted)]">
          {staffView
            ? "Your sales history for today. Record new sales in POS."
            : "Sales history across stores. New sales are recorded in POS."}
        </p>
        <Link href="/pos" className="neu-btn px-4 py-2 text-sm accent-text">
          Open POS
        </Link>
      </div>

      {!staffView && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-[var(--muted)]">Filter by store</label>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="neu-inset px-3 py-2 text-sm"
          >
            <option value="">All stores</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="neu-flat overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Product</th>
              {!staffView && <th className="px-4 py-3">Store</th>}
              {!staffView && <th className="px-4 py-3">Cashier</th>}
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {displaySales.map((s) => (
              <tr key={s.id} className="border-b border-[var(--shadow-dark)]/20">
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {new Date(s.transaction_time).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {s.product}
                  <span className="block text-xs text-[var(--muted)]">{s.variant_label}</span>
                </td>
                {!staffView && <td className="px-4 py-3">{s.store_name || s.shop}</td>}
                {!staffView && <td className="px-4 py-3 accent-text">{s.cashier}</td>}
                <td className="px-4 py-3">{s.quantity}</td>
                <td className="px-4 py-3 font-medium">KES {s.total.toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{s.payment_method}</td>
              </tr>
            ))}
            {displaySales.length === 0 && (
              <tr>
                <td colSpan={staffView ? 5 : 7} className="px-4 py-10 text-center text-[var(--muted)]">
                  {staffView ? "No sales today yet." : "No sales found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
