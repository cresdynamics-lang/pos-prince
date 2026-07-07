"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/api";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
];

type Props = {
  children: React.ReactNode;
  /** Tighter layout for phone POS screens */
  compact?: boolean;
};

export function AppShell({ children, compact = false }: Props) {
  const pathname = usePathname();
  const onPos = pathname === "/pos";

  return (
    <div
      className={`min-h-screen ${compact ? "px-2 py-2 sm:px-4 sm:py-4" : "p-4 md:p-6"}`}
    >
      <header
        className={`neu-flat mb-3 flex items-center justify-between gap-2 ${
          compact ? "px-3 py-2.5 sm:px-4 sm:py-3" : "mb-6 flex-wrap gap-4 px-6 py-4"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] sm:text-xs">
            Point of Sale
          </p>
          <h1 className={`truncate font-semibold accent-text ${compact ? "text-base sm:text-lg" : "text-xl"}`}>
            {BRAND.name}
          </h1>
        </div>
        <nav className="flex shrink-0 gap-1.5 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`neu-btn font-medium ${
                compact ? "px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm" : "px-4 py-2 text-sm"
              } ${pathname === link.href ? "active accent-text" : "text-[var(--muted)]"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
      {!compact && (
        <footer className="mt-8 text-center text-xs text-[var(--muted)]">
          {BRAND.phone} · {BRAND.email}
          <span className="mt-2 block">
            Install: browser menu → Add to Home Screen for offline POS
          </span>
        </footer>
      )}
      {compact && onPos && (
        <p className="mt-3 text-center text-[10px] text-[var(--muted)]">
          Swipe categories → · scroll for products &amp; cart
        </p>
      )}
    </div>
  );
}
