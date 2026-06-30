import Link from "next/link";
import { BRAND, fetchCategories } from "@/lib/api";

export default async function HomePage() {
  const categories = await fetchCategories();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="neu-flat w-full max-w-lg p-10 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Welcome</p>
        <h1 className="mt-2 text-3xl font-semibold accent-text">{BRAND.name} POS</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Multi-shop retail — {categories.length} top-level categories loaded
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/pos" className="neu-btn px-6 py-3 text-sm font-semibold accent-text">
            Open Cashier POS
          </Link>
          <Link href="/dashboard" className="neu-btn px-6 py-3 text-sm text-[var(--muted)]">
            Director Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
