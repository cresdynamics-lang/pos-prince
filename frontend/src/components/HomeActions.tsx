"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, syncSessionCookie, type AuthUser } from "@/lib/auth";

export function HomeActions({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    syncSessionCookie();
    setUser(getUser());
  }, []);

  if (user) {
    if (compact) {
      return (
        <Link href="/admin/dashboard" className="neu-btn px-5 py-2.5 text-sm font-medium accent-text">
          Dashboard
        </Link>
      );
    }
    return (
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/dashboard" className="neu-btn px-6 py-3 text-sm font-semibold accent-text">
          Go to dashboard
        </Link>
        <Link href="/pos" className="neu-btn px-6 py-3 text-sm text-[var(--muted)]">
          Open POS
        </Link>
      </div>
    );
  }

  if (compact) {
    return (
      <Link href="/login" className="neu-btn px-5 py-2.5 text-sm font-medium accent-text">
        Staff sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/login" className="neu-btn px-6 py-3 text-sm font-semibold accent-text">
        Sign in to dashboard
      </Link>
      <Link href="/login?next=/pos" className="neu-btn px-6 py-3 text-sm text-[var(--muted)]">
        Sign in to POS
      </Link>
    </div>
  );
}
