"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdleLock } from "@/hooks/useIdleLock";
import { clearSession, getToken, getUser, isIdleExpired, lockSession } from "@/lib/auth";

/** Validates session on protected routes; locks after idle timeout. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useIdleLock();

  useEffect(() => {
    const user = getUser();
    const token = getToken();
    if (!user || !token) {
      clearSession();
      router.replace("/login");
      return;
    }
    if (isIdleExpired()) {
      lockSession("idle");
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
