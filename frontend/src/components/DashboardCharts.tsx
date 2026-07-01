"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const GOLD = "#b8860b";
const COLORS = ["#b8860b", "#8b6914", "#d4a84b", "#5c4d2e", "#c9a227", "#7a6520"];

export type ChartPoint = { label: string; value: number };

export type DashboardData = {
  summary: {
    sales_today: number;
    revenue_today: number;
    profit_today: number;
    orders_today: number;
  };
  revenue_trend: ChartPoint[];
  sales_by_category: ChartPoint[];
  top_products: ChartPoint[];
};

function fmtKes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export function SummaryCards({
  summary,
  variant = "director",
}: {
  summary: DashboardData["summary"];
  variant?: "director" | "staff";
}) {
  const cards =
    variant === "staff"
      ? [
          { label: "Units sold today", value: String(summary.sales_today), sub: "items sold at your store" },
          { label: "Orders today", value: String(summary.orders_today), sub: "completed transactions" },
          {
            label: "Avg units per order",
            value:
              summary.orders_today > 0
                ? (summary.sales_today / summary.orders_today).toFixed(1)
                : "0",
            sub: "sales activity",
          },
        ]
      : [
          { label: "Sales Today", value: String(summary.sales_today), sub: "units sold" },
          { label: "Revenue Today", value: fmtKes(summary.revenue_today), sub: "gross" },
          { label: "Profit Today", value: fmtKes(summary.profit_today), sub: "after cost" },
          { label: "Orders", value: String(summary.orders_today), sub: "transactions" },
        ];

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${variant === "staff" ? "lg:grid-cols-3" : "xl:grid-cols-4"}`}>
      {cards.map((c) => (
        <div key={c.label} className="neu-flat p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{c.label}</p>
          <p className="mt-2 text-2xl font-semibold accent-text">{c.value}</p>
          <p className="text-[10px] text-[var(--muted)]">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function RevenueLineChart({ data }: { data: ChartPoint[] }) {
  const chartData = data.map((d) => ({ name: d.label, revenue: d.value }));
  return (
    <div className="neu-flat p-4">
      <h3 className="mb-4 text-sm font-semibold">Revenue trend (7 days)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#c5ccd6" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => fmtKes(Number(v))} />
          <Line type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPieChart({
  data,
  hideAmounts = false,
}: {
  data: ChartPoint[];
  hideAmounts?: boolean;
}) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  return (
    <div className="neu-flat p-4">
      <h3 className="mb-4 text-sm font-semibold">
        {hideAmounts ? "Sales mix by category" : "Sales by category"}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={
              hideAmounts
                ? (v, _n, item) => {
                    const total = chartData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((Number(v) / total) * 100).toFixed(0) : "0";
                    return `${item?.payload?.name ?? ""}: ${pct}%`;
                  }
                : (v) => fmtKes(Number(v))
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProductsBar({ data }: { data: ChartPoint[] }) {
  const chartData = data.map((d) => ({ name: d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label, units: d.value }));
  return (
    <div className="neu-flat p-4">
      <h3 className="mb-4 text-sm font-semibold">Fast-moving products</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#c5ccd6" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="units" fill={GOLD} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const EMPTY_DASHBOARD: DashboardData = {
  summary: { sales_today: 0, revenue_today: 0, profit_today: 0, orders_today: 0 },
  revenue_trend: [],
  sales_by_category: [],
  top_products: [],
};
