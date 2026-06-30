"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND, getUser, login } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getUser()) {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      const next = searchParams.get("next") || "/admin/dashboard";
      router.push(next.startsWith("/login") ? "/admin/dashboard" : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="neu-flat w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold accent-text">{BRAND.name}</h1>
        <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Access is restricted to authorized staff only.
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
