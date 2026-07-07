"use client";

import { useEffect, useState } from "react";
import { flushOfflineQueue, getOfflineQueue, isOnline } from "@/lib/offline";
import { apiFetch } from "@/lib/auth";

export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState("");

  const refreshPending = () => setPending(getOfflineQueue().length);

  useEffect(() => {
    setOnline(isOnline());
    refreshPending();

    async function sync() {
      if (!isOnline()) return;
      const before = getOfflineQueue().length;
      if (before === 0) return;
      const result = await flushOfflineQueue((payload) =>
        apiFetch("/sales/checkout", { method: "POST", body: JSON.stringify(payload) }),
      );
      setPending(getOfflineQueue().length);
      if (result.synced > 0) {
        setSyncMsg(`Synced ${result.synced} offline sale(s)`);
      }
    }

    const onOnline = () => {
      setOnline(true);
      sync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    sync();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { online, pending, syncMsg, clearMsg: () => setSyncMsg(""), refreshPending };
}
