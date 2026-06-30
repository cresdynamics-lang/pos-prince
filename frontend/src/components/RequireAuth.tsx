"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, getUser } from "@/lib/auth";

/** Validates session on admin routes; clears stale local state if cookie missing. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    const token = getToken();
    if (!user || !token) {
      clearSession();
      router.replace("/login");
    }
  }, [router]);

  if (!getUser()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="neu-flat px-8 py-6 text-sm text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
