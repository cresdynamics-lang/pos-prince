"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pos-sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
