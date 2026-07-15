export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" ? "/api/v1" : "/api/v1");

export type UserRole = "director" | "shop_manager" | "cashier";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  shop_id?: string | null;
  permissions: string[];
  is_active?: boolean;
  is_super_admin?: boolean;
};

export const SUPER_ADMIN_EMAIL = "charles@prince-esquire.co.ke";

export function isSuperAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

const TOKEN_KEY = "prince_pos_token";
const USER_KEY = "prince_pos_user";
const SESSION_COOKIE = "prince_pos_session";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setSessionCookie() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=86400; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/** Restore session cookie when localStorage still has a valid token (e.g. after PWA reload). */
export function syncSessionCookie() {
  if (typeof window === "undefined") return;
  if (getToken() && getUser()) {
    setSessionCookie();
  }
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setSessionCookie();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionCookie();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isLogin = path.includes("/auth/login");
  const token = isLogin ? null : getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutMs = isLogin ? 20_000 : 30_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Server is taking too long. Check your connection and try again.");
    }
    throw new Error(
      "Cannot reach the server (Failed to fetch). Check internet, refresh the page, then try again.",
    );
  }

  if (res.status === 401 && typeof window !== "undefined" && !isLogin) {
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error("POS server is temporarily unavailable. Wait a moment and try again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error ?? `Request failed (${res.status})`;
    if (res.status === 400 && path.includes("/auth/login")) {
      throw new Error("Invalid email or password (password must be at least 6 characters)");
    }
    throw new Error(msg === "invalid credentials payload" ? "Invalid email or password" : msg);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession(data.token, data.user);
  return data.user;
}

export function hasPermission(user: AuthUser | null, perm: string): boolean {
  return !!user?.permissions?.includes(perm);
}

export function hasAnyPermission(user: AuthUser | null, perms: string[]): boolean {
  return perms.some((p) => hasPermission(user, p));
}

/** Shop managers and cashiers — personal sales UI, no company finance/revenue. */
export function isStaffUser(user: AuthUser | null): boolean {
  return user?.role === "shop_manager" || user?.role === "cashier";
}

export function isDirector(user: AuthUser | null): boolean {
  return user?.role === "director";
}

export const PERMS = {
  dashboard: "dashboard.view",
  analytics: "analytics.view",
  inventory: "inventory.view",
  inventoryEdit: "inventory.edit",
  stores: "stores.view",
  storesEdit: "stores.edit",
  users: "users.view",
  usersCreate: "users.create",
  usersEdit: "users.edit",
  sales: "sales.view",
  salesCreate: "sales.create",
  revenue: "revenue.view",
  finance: "finance.view",
  financeEdit: "finance.edit",
  pos: "pos.access",
} as const;

export type NavItem = {
  href: string;
  label: string;
  permission: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", permission: PERMS.dashboard, icon: "◫" },
  { href: "/admin/notifications", label: "Notifications", permission: PERMS.analytics, icon: "◷" },
  { href: "/admin/analytics", label: "Analytics", permission: PERMS.analytics, icon: "◔" },
  { href: "/admin/reports", label: "Reports", permission: PERMS.analytics, icon: "▤" },
  { href: "/admin/sales", label: "Sales", permission: PERMS.sales, icon: "◎" },
  { href: "/admin/revenue", label: "Revenue", permission: PERMS.revenue, icon: "◈" },
  { href: "/admin/finance", label: "Finance", permission: PERMS.finance, icon: "₣" },
  { href: "/admin/inventory", label: "Inventory", permission: PERMS.inventory, icon: "▦" },
  { href: "/admin/stores", label: "Stores", permission: PERMS.stores, icon: "⌂" },
  { href: "/admin/users", label: "Users", permission: PERMS.users, icon: "◉" },
  { href: "/pos", label: "POS", permission: PERMS.pos, icon: "⛁" },
];

export const ALL_PERMISSIONS = [
  { key: PERMS.dashboard, label: "View Dashboard" },
  { key: PERMS.analytics, label: "View Analytics" },
  { key: "inventory.edit", label: "Edit Inventory" },
  { key: PERMS.inventory, label: "View Inventory" },
  { key: PERMS.stores, label: "View Stores" },
  { key: "stores.edit", label: "Edit Stores" },
  { key: PERMS.users, label: "View Users" },
  { key: PERMS.usersCreate, label: "Create Users" },
  { key: "users.edit", label: "Edit Users" },
  { key: PERMS.sales, label: "View Sales" },
  { key: "sales.create", label: "Process Sales" },
  { key: PERMS.revenue, label: "View Revenue" },
  { key: PERMS.finance, label: "View Finance" },
  { key: PERMS.financeEdit, label: "Record Expenses" },
  { key: PERMS.pos, label: "Access POS" },
];

export function permissionForPath(pathname: string): string | null {
  if (pathname.startsWith("/admin/expenses")) {
    return null; // checked via canAccessExpenses
  }
  const item = NAV_ITEMS.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  return item?.permission ?? null;
}

export function canAccessPath(user: AuthUser | null, pathname: string): boolean {
  if (!user) return false;
  if (pathname.startsWith("/admin/expenses") && !isDirector(user)) {
    return false;
  }
  if (
    (pathname.startsWith("/admin/revenue") ||
      pathname.startsWith("/admin/finance") ||
      pathname.startsWith("/admin/notifications") ||
      pathname.startsWith("/admin/activity") ||
      pathname.startsWith("/admin/reports")) &&
    !isDirector(user)
  ) {
    return false;
  }
  const perm = permissionForPath(pathname);
  if (!perm) return true;
  return hasPermission(user, perm);
}

export const BRAND = {
  name: "Prince Esquire",
  phone: "0724-494089",
  email: "prince-esquire@gmail.com",
  web: "https://prince-esquire.co.ke",
};

// Re-export categories API from api.ts legacy
export { fetchCategories, FALLBACK_CATEGORIES, type Category } from "./catalog";
