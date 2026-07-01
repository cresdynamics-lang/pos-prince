import Link from "next/link";
import { BRAND } from "@/lib/auth";

const features = [
  {
    title: "Multi-shop inventory",
    description: "Track stock across every Prince Esquire location in one place.",
  },
  {
    title: "Point of sale",
    description: "Ring up sales, manage variants, and keep checkout fast at the counter.",
  },
  {
    title: "Reports & finance",
    description: "Daily sales, revenue, expenses, and store performance at a glance.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-lg font-semibold accent-text">{BRAND.name}</p>
          <p className="text-xs text-[var(--muted)]">Point of Sale</p>
        </div>
        <Link href="/login" className="neu-btn px-5 py-2.5 text-sm font-medium accent-text">
          Staff sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <section className="neu-flat grid gap-10 p-8 md:grid-cols-[1.2fr_1fr] md:p-12">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Retail operations
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
              Run every shop from one POS
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
              Prince Esquire&apos;s internal system for inventory, sales, transfers, and
              reporting across fashion categories — from polos and shirts to shoes and
              accessories.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="neu-btn px-6 py-3 text-sm font-semibold accent-text"
              >
                Sign in to dashboard
              </Link>
              <a
                href={BRAND.web}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-btn px-6 py-3 text-sm text-[var(--muted)]"
              >
                Visit store website
              </a>
            </div>
          </div>

          <div className="neu-inset flex flex-col justify-center gap-4 p-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">For staff</p>
            <p className="text-sm leading-relaxed">
              Directors, shop managers, and cashiers sign in with their assigned account
              to access the dashboard, POS, and store tools they are permitted to use.
            </p>
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>· Directors — all shops and reports</li>
              <li>· Shop managers — assigned store operations</li>
              <li>· Cashiers — sales and stock visibility</li>
            </ul>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="neu-flat p-6">
              <h2 className="text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--shadow-dark)]/20 px-6 py-8 text-center text-xs text-[var(--muted)]">
        {BRAND.name} · {BRAND.phone} · {BRAND.email}
      </footer>
    </div>
  );
}
