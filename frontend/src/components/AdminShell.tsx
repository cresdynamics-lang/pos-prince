"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BRAND,
  NAV_ITEMS,
  canAccessPath,
  clearSession,
  getUser,
  hasAnyPermission,
  hasPermission,
  PERMS,
  type AuthUser,
} from "@/lib/auth";
import { useStore } from "@/lib/store-context";

function canAccessExpenses(user: AuthUser) {
  return hasAnyPermission(user, [
    PERMS.finance,
    PERMS.financeEdit,
    PERMS.revenue,
    PERMS.sales,
    PERMS.salesCreate,
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const { stores, selectedStoreId, setSelectedStoreId, selectedStore, isAllStores, loading } = useStore();

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    if (pathname.startsWith("/admin") && !canAccessPath(u, pathname)) {
      const fallback = NAV_ITEMS.find((item) => hasPermission(u, item.permission));
      router.replace(fallback?.href ?? "/login");
    }
  }, [router, pathname]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="neu-flat px-8 py-6 text-sm text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  const mainNav = NAV_ITEMS.filter(
    (item) => item.href !== "/pos" && hasPermission(user, item.permission),
  );
  const posNav = NAV_ITEMS.filter((item) => item.href === "/pos" && hasPermission(user, item.permission));
  const showExpenses = canAccessExpenses(user);
  const lockedStore = Boolean(user.shop_id && (user.role === "shop_manager" || user.role === "cashier"));

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="neu-flat m-4 flex h-[calc(100vh-2rem)] w-64 shrink-0 flex-col overflow-y-auto p-4 sticky top-0">
        <div className="mb-6 px-2">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Prince Esquire</p>
          <h1 className="text-lg font-semibold accent-text">Admin Panel</h1>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">{user.name}</p>
          <p className="text-[10px] capitalize text-[var(--muted)]">{user.role.replace("_", " ")}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`neu-btn flex items-center gap-3 px-3 py-2.5 text-sm ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "active accent-text font-medium"
                  : "text-[var(--muted)]"
              }`}
            >
              <span className="text-base opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {posNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`neu-btn flex items-center gap-3 px-3 py-2.5 text-sm ${
                pathname === item.href ? "active accent-text font-medium" : "text-[var(--muted)]"
              }`}
            >
              <span className="text-base opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {showExpenses && (
            <Link
              href="/admin/expenses"
              className={`neu-btn flex items-center gap-3 px-3 py-2.5 text-sm ${
                pathname === "/admin/expenses" ? "active accent-text font-medium" : "text-[var(--muted)]"
              }`}
            >
              <span className="text-base opacity-70">⊖</span>
              Expenses
            </Link>
          )}
        </nav>

        <button
          type="button"
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
          className="neu-btn mt-4 px-3 py-2 text-left text-xs text-[var(--muted)]"
        >
          Sign out
        </button>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 pr-6">
        <header className="neu-flat mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs text-[var(--muted)]">{BRAND.name} POS</p>
            <h2 className="text-xl font-semibold capitalize">
              {pathname.split("/").pop()?.replace("-", " ") ?? "Dashboard"}
            </h2>
            {!isAllStores && selectedStore && (
              <p className="mt-1 text-sm font-medium accent-text">{selectedStore.name}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Store
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                disabled={lockedStore || loading}
                className="neu-inset w-full px-3 py-2 text-sm"
              >
                {!lockedStore && <option value="">All stores (grand total)</option>}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right text-xs text-[var(--muted)]">
              <p>{BRAND.phone}</p>
              <p>{user.email}</p>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
