"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getUser, hasPermission, PERMS } from "@/lib/auth";
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
  order_net_total?: number | null;
  total: number;
  payment_method: string;
  transaction_time: string;
};

type Shop = { id: string; name: string };

type Variant = {
  id: string;
  product: string;
  category: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  price: number;
  stock?: number;
  stores?: StoreStock[];
};

type StoreStock = {
  store_id: string;
  store_name: string;
  quantity: number;
};

type CartLine = {
  key: string;
  variant_id: string;
  product: string;
  variant_label: string;
  sku: string;
  list_price: number;
  sale_price: number;
  quantity: number;
  inventory_shop_id: string;
  inventory_shop_name: string;
  store_stocks: StoreStock[];
};

function variantLabel(v: Variant) {
  const parts = [v.color, v.size ? `Size ${v.size}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Standard";
}

export function SalesPageClient() {
  const { selectedStoreId, stores: contextStores } = useStore();
  const [tab, setTab] = useState<"record" | "history">("record");
  const [sales, setSales] = useState<Sale[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [sellingStore, setSellingStore] = useState("");
  const [search, setSearch] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [payment, setPayment] = useState("cash");
  const [msg, setMsg] = useState("");

  const me = getUser();
  const canRecord = hasPermission(me, PERMS.salesCreate);

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
        const defaultStore = selectedStoreId || list[0]?.id || "";
        if (defaultStore) {
          setSellingStore((s) => selectedStoreId || s || defaultStore);
          setStoreFilter((f) => selectedStoreId || f);
        }
      })
      .catch(() => {});
  }, [selectedStoreId, contextStores]);

  useEffect(() => {
    if (selectedStoreId) {
      setSellingStore(selectedStoreId);
      setStoreFilter(selectedStoreId);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (tab === "history") loadSales();
  }, [tab, loadSales]);

  useEffect(() => {
    if (!sellingStore) return;
    const params = new URLSearchParams({ shop_id: sellingStore, include_stores: "1" });
    if (search.trim()) params.set("q", search.trim());
    apiFetch<{ variants: Variant[] }>(`/variants?${params}`)
      .then((d) => setVariants(d.variants ?? []))
      .catch(() => setVariants([]));
  }, [sellingStore, search]);

  const totals = useMemo(() => {
    let gross = 0;
    let lineDiscount = 0;
    let net = 0;
    for (const line of cart) {
      const g = line.list_price * line.quantity;
      const n = line.sale_price * line.quantity;
      gross += g;
      lineDiscount += Math.max(0, g - n);
      net += n;
    }
    const finalNet = Math.max(0, net - overallDiscount);
    return { gross, lineDiscount, net, finalNet };
  }, [cart, overallDiscount]);

  async function addToCart(v: Variant) {
    let stocks: StoreStock[] = v.stores ?? [];
    if (stocks.length === 0) {
      try {
        const detail = await apiFetch<{ stores: StoreStock[] }>(`/variants/${v.id}`);
        stocks = detail.stores ?? [];
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not load stock for this product");
        return;
      }
    }

    const defaultStock =
      stocks.find((s) => s.store_id === sellingStore && s.quantity > 0) ??
      stocks.find((s) => s.quantity > 0) ??
      stocks.find((s) => s.store_id === sellingStore) ??
      stocks[0];

    if (!defaultStock) {
      setMsg("No stock record for this product");
      return;
    }

    const invShop = shops.find((s) => s.id === defaultStock.store_id);
    const label = variantLabel(v);
    const existing = cart.find(
      (c) => c.variant_id === v.id && c.inventory_shop_id === defaultStock.store_id
    );
    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c.key === existing.key ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        key: `${v.id}-${defaultStock.store_id}`,
        variant_id: v.id,
        product: v.product,
        variant_label: label,
        sku: v.sku,
        list_price: v.price,
        sale_price: v.price,
        quantity: 1,
        inventory_shop_id: defaultStock.store_id,
        inventory_shop_name: invShop?.name ?? defaultStock.store_name,
        store_stocks: stocks,
      },
    ]);
    setMsg("");
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  async function checkout() {
    if (!sellingStore || cart.length === 0) return;
    setMsg("");
    try {
      const res = await apiFetch<{
        order_id: string;
        net_total: number;
        line_discount_total: number;
        overall_discount: number;
      }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify({
          shop_id: sellingStore,
          payment_method: payment,
          overall_discount: overallDiscount,
          items: cart.map((c) => ({
            product_variant_id: c.variant_id,
            quantity: c.quantity,
            sale_price: c.sale_price,
            inventory_shop_id:
              c.inventory_shop_id !== sellingStore ? c.inventory_shop_id : undefined,
          })),
        }),
      });
      setMsg(
        `Sale recorded — order ${res.order_id.slice(0, 8)}… · Net KES ${res.net_total.toLocaleString()}`
      );
      setCart([]);
      setOverallDiscount(0);
      loadSales();
      setTab("history");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("record")}
          className={`neu-btn px-4 py-2 text-sm ${tab === "record" ? "active accent-text" : ""}`}
        >
          Record sale
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`neu-btn px-4 py-2 text-sm ${tab === "history" ? "active accent-text" : ""}`}
        >
          Sales history
        </button>
      </div>

      {tab === "record" && canRecord && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Selling store</label>
                <select
                  value={sellingStore}
                  onChange={(e) => setSellingStore(e.target.value)}
                  className="neu-inset px-3 py-2 text-sm"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-[var(--muted)]">Search products</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or SKU"
                  className="neu-inset w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="neu-flat max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">List</th>
                    <th className="px-3 py-2">Stock here</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-b border-[var(--shadow-dark)]/20">
                      <td className="px-3 py-2">
                        {v.product}
                        <span className="block text-xs text-[var(--muted)]">
                          {variantLabel(v)} · {v.sku}
                        </span>
                      </td>
                      <td className="px-3 py-2">KES {v.price.toLocaleString()}</td>
                      <td className="px-3 py-2">{v.stock ?? 0}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="neu-btn px-2 py-1 text-xs accent-text"
                          onClick={() => addToCart(v)}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                  {variants.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="sticky top-4 flex max-h-[calc(100vh-10rem)] flex-col self-start neu-flat p-4">
            <h2 className="mb-3 shrink-0 text-sm font-semibold uppercase accent-text">Cart</h2>
            <div className="neu-inset min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
              {cart.length === 0 && (
                <p className="text-[var(--muted)]">Add products to start a sale.</p>
              )}
              {cart.map((line) => {
                const lineDisc = Math.max(
                  0,
                  (line.list_price - line.sale_price) * line.quantity
                );
                const selectedStock =
                  line.store_stocks.find((s) => s.store_id === line.inventory_shop_id)?.quantity ?? 0;
                return (
                  <div key={line.key} className="border-b border-[var(--shadow-dark)]/20 pb-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium">{line.product}</p>
                        <p className="text-xs text-[var(--muted)]">{line.variant_label}</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-700"
                        onClick={() => removeLine(line.key)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--muted)]">Qty</label>
                        <input
                          type="number"
                          min={1}
                          max={selectedStock}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, { quantity: Number(e.target.value) })
                          }
                          className="neu-inset w-16 px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-[var(--muted)]">avail {selectedStock}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--muted)]">Sold at</label>
                        <input
                          type="number"
                          min={0}
                          value={line.sale_price}
                          onChange={(e) =>
                            updateLine(line.key, { sale_price: Number(e.target.value) })
                          }
                          className="neu-inset flex-1 px-2 py-1 text-xs"
                        />
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        List KES {line.list_price.toLocaleString()}
                        {lineDisc > 0 && (
                          <span className="ml-2 text-red-700">
                            −KES {lineDisc.toLocaleString()} item discount
                          </span>
                        )}
                      </p>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Stock from store</label>
                        <select
                          value={line.inventory_shop_id}
                          onChange={(e) => {
                            const shop = shops.find((s) => s.id === e.target.value);
                            updateLine(line.key, {
                              inventory_shop_id: e.target.value,
                              inventory_shop_name: shop?.name ?? "",
                            });
                          }}
                          className="neu-inset mt-1 w-full px-2 py-1 text-xs"
                        >
                          {line.store_stocks.map((s) => (
                            <option key={s.store_id} value={s.store_id}>
                              {s.store_name} ({s.quantity} in stock)
                            </option>
                          ))}
                        </select>
                        {line.inventory_shop_id !== sellingStore && (
                          <p className="mt-1 text-xs accent-text">
                            Borrowed from {line.inventory_shop_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 shrink-0 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Gross</span>
                <span>KES {totals.gross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Item discounts</span>
                <span>−KES {totals.lineDiscount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--muted)]">Overall discount</span>
                <input
                  type="number"
                  min={0}
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value))}
                  className="neu-inset w-28 px-2 py-1 text-right text-sm"
                />
              </div>
              <div className="flex justify-between border-t border-[var(--shadow-dark)]/30 pt-2 font-semibold">
                <span>Net total</span>
                <span className="accent-text">KES {totals.finalNet.toLocaleString()}</span>
              </div>
              <div>
                <p className="mb-2 text-xs text-[var(--muted)]">Payment method</p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "cash", label: "Cash" },
                      { value: "mpesa", label: "M-Pesa" },
                      { value: "card", label: "Card" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPayment(m.value)}
                      className={`neu-btn flex-1 py-2 text-xs ${
                        payment === m.value ? "active accent-text" : ""
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={checkout}
                className="neu-btn w-full py-3 text-sm font-semibold accent-text disabled:opacity-50"
              >
                Complete sale
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === "record" && !canRecord && (
        <p className="text-sm text-[var(--muted)]">You do not have permission to record sales.</p>
      )}

      {tab === "history" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-[var(--muted)]">Filter by store</label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="neu-inset px-3 py-2 text-sm"
            >
              <option value="">All stores</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="neu-flat overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Sold at store</th>
                  <th className="px-4 py-3">Stock from</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">List</th>
                  <th className="px-4 py-3">Item disc.</th>
                  <th className="px-4 py-3">Order disc.</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const seenOrders = new Set<string>();
                  return sales.map((s) => {
                    const showOrderDisc =
                      !!s.order_id && s.overall_discount > 0 && !seenOrders.has(s.order_id);
                    if (showOrderDisc && s.order_id) seenOrders.add(s.order_id);
                    return (
                  <tr key={s.id} className="border-b border-[var(--shadow-dark)]/20">
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {new Date(s.transaction_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {s.product}
                      <span className="block text-xs text-[var(--muted)]">{s.variant_label}</span>
                    </td>
                    <td className="px-4 py-3">{s.store_name || s.shop}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {s.inventory_shop !== s.store_name && s.inventory_shop !== s.shop
                        ? s.inventory_shop
                        : "—"}
                    </td>
                    <td className="px-4 py-3 accent-text">{s.cashier}</td>
                    <td className="px-4 py-3">KES {(s.list_price * s.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-700">
                      {s.discount_amount > 0 ? `−KES ${s.discount_amount.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-red-700">
                      {showOrderDisc ? `−KES ${s.overall_discount.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">KES {s.total.toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{s.payment_method}</td>
                  </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
