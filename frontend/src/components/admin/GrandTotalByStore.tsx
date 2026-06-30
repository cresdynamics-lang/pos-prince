"use client";

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

export function GrandTotalByStore({ rows }: { rows: StoreToday[] }) {
  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue_today,
      profit: acc.profit + r.profit_today,
      expenses: acc.expenses + r.expenses_today,
      net: acc.net + r.net_today,
      units: acc.units + r.units_sold,
    }),
    { revenue: 0, profit: 0, expenses: 0, net: 0, units: 0 },
  );

  return (
    <div className="neu-flat overflow-x-auto">
      <h3 className="border-b border-[var(--shadow-dark)]/30 px-4 py-3 text-sm font-semibold">
        Grand total by store (today)
      </h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-[var(--muted)]">
            <th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Profit</th>
            <th className="px-4 py-3">Expenses</th>
            <th className="px-4 py-3">Net</th>
            <th className="px-4 py-3">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.store_id} className="border-t border-[var(--shadow-dark)]/20">
              <td className="px-4 py-3 font-medium">{r.store_name}</td>
              <td className="px-4 py-3">KES {r.revenue_today.toLocaleString()}</td>
              <td className="px-4 py-3">KES {r.profit_today.toLocaleString()}</td>
              <td className="px-4 py-3 text-red-700">KES {r.expenses_today.toLocaleString()}</td>
              <td className="px-4 py-3 accent-text">KES {r.net_today.toLocaleString()}</td>
              <td className="px-4 py-3">{r.units_sold}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--shadow-dark)]/40 bg-[var(--shadow-dark)]/5 font-semibold">
            <td className="px-4 py-3">All stores</td>
            <td className="px-4 py-3">KES {totals.revenue.toLocaleString()}</td>
            <td className="px-4 py-3">KES {totals.profit.toLocaleString()}</td>
            <td className="px-4 py-3 text-red-700">KES {totals.expenses.toLocaleString()}</td>
            <td className="px-4 py-3 accent-text">KES {totals.net.toLocaleString()}</td>
            <td className="px-4 py-3">{totals.units}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
