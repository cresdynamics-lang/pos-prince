"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND, getIdleLockMs, getUser, login, syncSessionCookie } from "@/lib/auth";
import { InstallPwaBanner } from "@/components/PwaRegister";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lockReason = searchParams.get("reason");
  const idleLocked = lockReason === "idle";
  const sessionExpired = lockReason === "expired";
  const idleMinutes = Math.round(getIdleLockMs() / 60_000);

  useEffect(() => {
    syncSessionCookie();
    if (getUser()) {
      const next = searchParams.get("next") || "/admin/dashboard";
      router.replace(next.startsWith("/login") ? "/admin/dashboard" : next);
    }
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      const next = searchParams.get("next") || "/admin/dashboard";
      const dest = next.startsWith("/login") ? "/admin/dashboard" : next;
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-4 w-full max-w-md">
        <InstallPwaBanner />
      </div>
      <div className="neu-flat w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold accent-text">{BRAND.name}</h1>
        <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
        {idleLocked && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Session locked after {idleMinutes} minute{idleMinutes === 1 ? "" : "s"} of inactivity. Sign in again to continue.
          </p>
        )}
        {sessionExpired && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Your session has expired. Sign in again to continue.
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Access is restricted to authorized staff only.{" "}
          <a href="/" className="underline underline-offset-2">
            Back to home
          </a>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs text-[var(--muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="neu-inset mt-1 w-full px-4 py-3 text-sm outline-none"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neu-inset mt-1 w-full px-4 py-3 text-sm outline-none"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="neu-btn w-full py-3 text-sm font-semibold accent-text disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-[10px] text-[var(--muted)]">
          {BRAND.phone} · Authorized access only
        </p>
      </div>
    </div>
  );
}
