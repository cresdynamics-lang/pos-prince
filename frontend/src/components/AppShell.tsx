"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/api";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen p-4 md:p-6">
      <header className="neu-flat mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Point of Sale</p>
          <h1 className="text-xl font-semibold accent-text">{BRAND.name}</h1>
        </div>
        <nav className="flex gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`neu-btn px-4 py-2 text-sm font-medium ${
                pathname === link.href ? "active accent-text" : "text-[var(--muted)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
      <footer className="mt-8 text-center text-xs text-[var(--muted)]">
        {BRAND.phone} · {BRAND.email}
      </footer>
    </div>
  );
}
