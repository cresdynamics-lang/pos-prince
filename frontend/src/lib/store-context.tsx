"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, getUser } from "@/lib/auth";

export type Store = {
  id: string;
  name: string;
  location?: string | null;
  phone?: string | null;
  manager_id?: string | null;
  is_active: boolean;
};

type StoreContextValue = {
  stores: Store[];
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
  selectedStore: Store | null;
  isAllStores: boolean;
  shopQuery: string;
  refreshStores: () => void;
  loading: boolean;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const STORAGE_KEY = "prince_pos_store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshStores = useCallback(() => {
    apiFetch<{ shops: Store[] }>("/shops?include_inactive=1")
      .then((d) => {
        const list = (d.shops ?? []).filter((s) => s.is_active);
        setStores(list);
      })
      .catch(() => setStores([]));
  }, []);

  useEffect(() => {
    const user = getUser();
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

    apiFetch<{ shops: Store[] }>("/shops")
      .then((d) => {
        const list = d.shops ?? [];
        setStores(list);
        if (user?.shop_id && (user.role === "shop_manager" || user.role === "cashier")) {
          setSelectedStoreIdState(user.shop_id);
        } else if (saved !== null) {
          setSelectedStoreIdState(saved);
        } else {
          setSelectedStoreIdState("");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setSelectedStoreId = useCallback((id: string) => {
    const user = getUser();
    if (user?.shop_id && (user.role === "shop_manager" || user.role === "cashier")) {
      return;
    }
    setSelectedStoreIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const shopQuery = selectedStoreId ? `shop_id=${encodeURIComponent(selectedStoreId)}` : "";

  const value = useMemo(
    () => ({
      stores,
      selectedStoreId,
      setSelectedStoreId,
      selectedStore,
      isAllStores: !selectedStoreId,
      shopQuery,
      refreshStores,
      loading,
    }),
    [stores, selectedStoreId, setSelectedStoreId, selectedStore, shopQuery, refreshStores, loading],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useStoreApiPath(basePath: string) {
  const { shopQuery } = useStore();
  if (!shopQuery) return basePath;
  return basePath.includes("?") ? `${basePath}&${shopQuery}` : `${basePath}?${shopQuery}`;
}
