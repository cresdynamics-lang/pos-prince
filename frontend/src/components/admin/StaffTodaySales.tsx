"use client";

export type TodaySaleRow = {
  id: string;
  product: string;
  variant_label: string;
  quantity: number;
  total: number;
  payment_method: string;
  transaction_time: string;
};

export function StaffTodaySales({ sales }: { sales: TodaySaleRow[] }) {
  if (sales.length === 0) {
    return (
      <div className="neu-flat p-6 text-center text-sm text-[var(--muted)]">
        No sales recorded today yet. Use <strong className="accent-text">POS</strong> to record a sale.
      </div>
    );
  }

  return (
    <div className="neu-flat overflow-x-auto">
      <h3 className="border-b border-[var(--shadow-dark)]/20 px-4 py-3 text-sm font-semibold">
        Your sales today
      </h3>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--shadow-dark)]/30 text-xs uppercase text-[var(--muted)]">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Payment</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className="border-b border-[var(--shadow-dark)]/20">
              <td className="px-4 py-3 text-xs text-[var(--muted)]">
                {new Date(s.transaction_time).toLocaleTimeString()}
              </td>
              <td className="px-4 py-3">
                {s.product}
                <span className="block text-xs text-[var(--muted)]">{s.variant_label}</span>
              </td>
              <td className="px-4 py-3">{s.quantity}</td>
              <td className="px-4 py-3 font-medium">KES {s.total.toLocaleString()}</td>
              <td className="px-4 py-3 capitalize">{s.payment_method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
