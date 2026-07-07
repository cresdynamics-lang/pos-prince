"use client";

import { useEffect } from "react";
import {
  getIdleLockMs,
  getToken,
  isIdleExpired,
  lockSession,
  recordActivity,
} from "@/lib/auth";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "click"] as const;
const CHECK_INTERVAL_MS = 15_000;
const DEBOUNCE_MS = 1_000;

/** Locks the session after idle timeout with no taps, keys, scrolls, or API activity. */
export function useIdleLock() {
  useEffect(() => {
    if (!getToken()) return;

    if (isIdleExpired()) {
      lockSession("idle");
      return;
    }

    recordActivity();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        recordActivity();
        debounceTimer = null;
      }, DEBOUNCE_MS);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const interval = setInterval(() => {
      if (isIdleExpired()) lockSession("idle");
    }, Math.min(CHECK_INTERVAL_MS, getIdleLockMs() / 4));

    const onVisibility = () => {
      if (document.visibilityState === "visible" && isIdleExpired()) {
        lockSession("idle");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);
}
