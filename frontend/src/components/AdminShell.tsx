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
  hasPermission,
  isDirector,
  PERMS,
  type AuthUser,
  type NavItem,
} from "@/lib/auth";
import { useStore } from "@/lib/store-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

type NavProps = {
  user: AuthUser;
  pathname: string;
  mainNav: NavItem[];
  posNav: NavItem[];
  showExpenses: boolean;
  onNavigate?: () => void;
  onSignOut: () => void;
};

function SidebarNav({ user, pathname, mainNav, posNav, showExpenses, onNavigate, onSignOut }: NavProps) {
  const linkClass = (href: string, exact = false) => {
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
    return `neu-btn flex items-center gap-3 px-3 py-2.5 text-sm ${
      active ? "active accent-text font-medium" : "text-[var(--muted)]"
    }`;
  };

  return (
    <>
      <div className="mb-6 px-2">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Prince Esquire</p>
        <h1 className="text-lg font-semibold accent-text">Admin Panel</h1>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{user.name}</p>
        <p className="text-[10px] capitalize text-[var(--muted)]">{user.role.replace("_", " ")}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {mainNav.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(item.href)}>
            <span className="text-base opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {posNav.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(item.href, true)}>
            <span className="text-base opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {showExpenses && (
          <Link href="/admin/expenses" onClick={onNavigate} className={linkClass("/admin/expenses")}>
            <span className="text-base opacity-70">⊖</span>
            Expenses
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={onSignOut}
        className="neu-btn mt-4 px-3 py-2 text-left text-xs text-[var(--muted)]"
      >
        Sign out
      </button>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { stores, selectedStoreId, setSelectedStoreId, selectedStore, isAllStores, loading } = useStore();

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    if (pathname.startsWith("/admin") && !canAccessPath(u, pathname)) {
      const fallback = NAV_ITEMS.find(
        (item) => item.href !== "/pos" && canAccessPath(u, item.href),
      );
      router.replace(fallback?.href ?? "/login");
    }
  }, [router, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="neu-flat px-8 py-6 text-sm text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  const mainNav = NAV_ITEMS.filter((item) => {
    if (item.href === "/pos") return false;
    if (item.href === "/admin/notifications" && !isDirector(user)) return false;
    if ((item.href === "/admin/revenue" || item.href === "/admin/finance") && !isDirector(user)) {
      return false;
    }
    return hasPermission(user, item.permission);
  });
  const posNav = NAV_ITEMS.filter((item) => item.href === "/pos" && hasPermission(user, item.permission));
  const showExpenses = isDirector(user);
  const lockedStore = Boolean(user.shop_id && (user.role === "shop_manager" || user.role === "cashier"));

  const pageTitle = pathname.split("/").pop()?.replace(/-/g, " ") ?? "Dashboard";

  function signOut() {
    clearSession();
    router.push("/login");
  }

  const navProps: NavProps = {
    user,
    pathname,
    mainNav,
    posNav,
    showExpenses,
    onSignOut: signOut,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="neu-flat m-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col overflow-y-auto p-4 lg:flex">
        <SidebarNav {...navProps} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`neu-flat fixed inset-y-0 left-0 z-50 flex w-[min(85vw,17rem)] flex-col overflow-y-auto p-4 transition-transform duration-200 ease-out lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-xs font-medium accent-text">Menu</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="neu-btn px-2.5 py-1.5 text-sm text-[var(--muted)]"
          >
            ✕
          </button>
        </div>
        <SidebarNav {...navProps} onNavigate={() => setMenuOpen(false)} />
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4 lg:pr-6">
        <header className="neu-flat mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:mb-6 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="neu-btn shrink-0 px-3 py-2 text-lg leading-none text-[var(--muted)] lg:hidden"
            >
              ☰
            </button>
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--muted)] sm:text-xs">{BRAND.name} POS</p>
              <h2 className="truncate text-lg font-semibold capitalize sm:text-xl">{pageTitle}</h2>
              {!isAllStores && selectedStore && (
                <p className="mt-0.5 truncate text-xs font-medium accent-text sm:mt-1 sm:text-sm">
                  {selectedStore.name}
                </p>
              )}
              {isAllStores && !lockedStore && (
                <p className="mt-0.5 text-xs font-medium text-amber-800 sm:mt-1 sm:text-sm">
                  All stores
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto sm:gap-4">
            <div className="min-w-0 flex-1 sm:min-w-[200px] sm:flex-none">
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
            <div className="hidden text-right text-xs text-[var(--muted)] sm:block">
              <p>{BRAND.phone}</p>
              <p className="truncate max-w-[180px]">{user.email}</p>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
