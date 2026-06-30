"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUser, hasAnyPermission, hasPermission, PERMS } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

export type Expense = {
  id: string;
  shop_id?: string | null;
  shop_name?: string | null;
  category: string;
  amount: number;
  note?: string | null;
  recorded_by_name: string;
  expense_date: string;
};

type Shop = { id: string; name: string };

const EXPENSE_CATEGORIES = [
  { value: "marketing", label: "Marketing" },
  { value: "rent", label: "Rent" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  onRecorded?: () => void;
  className?: string;
  startOpen?: boolean;
};

export function ExpenseSidePanel({ onRecorded, className = "", startOpen = false }: Props) {
  const { selectedStoreId } = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [showForm, setShowForm] = useState(startOpen);
  const [category, setCategory] = useState<string>("marketing");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [shopId, setShopId] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");

  const me = getUser();
  const canRecord = hasAnyPermission(me, [PERMS.financeEdit, PERMS.salesCreate]);
  const shopLocked = Boolean(me?.shop_id && (me.role === "shop_manager" || me.role === "cashier"));

  const loadExpenses = useCallback(() => {
    const params = new URLSearchParams();
    const filterShop = selectedStoreId || (shopLocked ? me?.shop_id : "");
    if (filterShop) params.set("shop_id", filterShop);
    const q = params.toString() ? `?${params}` : "";
    apiFetch<{ expenses: Expense[] }>(`/expenses${q}`)
      .then((d) => setExpenses(d.expenses ?? []))
      .catch(() => setExpenses([]));
  }, [selectedStoreId, shopLocked, me?.shop_id]);

  useEffect(() => {
    loadExpenses();
    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => setShops(d.shops ?? []))
      .catch(() => {});
  }, [loadExpenses]);

  useEffect(() => {
    if (startOpen) {
      resetForm();
      const defaultShop = shopLocked ? me?.shop_id : selectedStoreId;
      if (defaultShop) setShopId(defaultShop);
      setShowForm(true);
    }
  }, [startOpen, selectedStoreId, shopLocked, me?.shop_id]);

  function resetForm() {
    setCategory("marketing");
    setAmount(0);
    setNote("");
    setShopId(shopLocked ? (me?.shop_id ?? "") : selectedStoreId || "");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setMsg("");
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setMsg("");
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    if (category === "other" && !note.trim()) {
      setMsg("Please describe the expense when category is Other");
      return;
    }
    const effectiveShop = shopId || selectedStoreId || me?.shop_id || null;
    if (!effectiveShop && !shopLocked) {
      setMsg("Select a store for this expense");
      return;
    }
    setMsg("");
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          category,
          amount,
          note: note.trim() || undefined,
          shop_id: effectiveShop,
          expense_date: expenseDate,
        }),
      });
      setMsg("Expense recorded");
      closeForm();
      loadExpenses();
      onRecorded?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to record expense");
    }
  }

  async function removeExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
      loadExpenses();
      onRecorded?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <aside
      className={`sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto neu-flat p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold accent-text">Expenses</h3>
        {canRecord && (
          <button type="button" className="neu-btn px-3 py-1.5 text-sm accent-text" onClick={openForm}>
            + Record expense
          </button>
        )}
      </div>

      {showForm && canRecord ? (
        <form onSubmit={submitExpense} className="mb-4 space-y-3 text-sm">
          <p className="text-xs font-medium text-[var(--muted)]">New expense</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="neu-inset w-full px-3 py-2"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            required
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Amount (KES)"
            className="neu-inset w-full px-3 py-2"
          />
          {!shopLocked ? (
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="neu-inset w-full px-3 py-2"
              required
            >
              <option value="">Select store</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Store: {shops.find((s) => s.id === shopId)?.name ?? "Your assigned store"}
            </p>
          )}
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="neu-inset w-full px-3 py-2"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={category === "other" ? "Describe this expense (required)" : "Note (optional)"}
            required={category === "other"}
            rows={3}
            className="neu-inset w-full px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="submit" className="neu-btn flex-1 py-2 accent-text">
              Save expense
            </button>
            <button type="button" onClick={closeForm} className="neu-btn px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        canRecord && (
          <p className="mb-4 text-sm text-[var(--muted)]">
            Click <strong>+ Record expense</strong> to log costs for the selected store.
          </p>
        )
      )}

      {!canRecord && (
        <p className="mb-4 text-xs text-[var(--muted)]">You can view expenses but not record them.</p>
      )}

      <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">Recent expenses</p>
      <div className="space-y-2">
        {expenses.slice(0, 15).map((ex) => (
          <div key={ex.id} className="neu-inset p-3 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-medium capitalize">{ex.category}</span>
              <span className="text-red-700">KES {ex.amount.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-[var(--muted)]">{ex.expense_date}</p>
            {ex.note && <p className="mt-1">{ex.note}</p>}
            {ex.shop_name && <p className="mt-1 text-[var(--muted)]">{ex.shop_name}</p>}
            {canRecord && (
              <button type="button" onClick={() => removeExpense(ex.id)} className="mt-2 text-red-700">
                Delete
              </button>
            )}
          </div>
        ))}
        {expenses.length === 0 && <p className="text-xs text-[var(--muted)]">No expenses yet.</p>}
      </div>

      {msg && <p className="mt-4 text-xs text-[var(--muted)]">{msg}</p>}
    </aside>
  );
}
