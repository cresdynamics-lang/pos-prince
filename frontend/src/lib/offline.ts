export type CheckoutItem = {
  product_variant_id: string;
  quantity: number;
  sale_price: number;
  inventory_shop_id?: string;
};

export type CheckoutPayload = {
  shop_id: string;
  payment_method: string;
  overall_discount: number;
  items: CheckoutItem[];
};

export type QueuedSale = CheckoutPayload & {
  id: string;
  created_at: string;
};

const QUEUE_KEY = "prince_pos_offline_queue";
const CATALOG_KEY = "prince_pos_catalog";
const VARIANTS_PREFIX = "prince_pos_variants_";

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function getOfflineQueue(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedSale[];
  } catch {
    return [];
  }
}

export function enqueueSale(payload: CheckoutPayload): QueuedSale {
  const sale: QueuedSale = {
    ...payload,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  const queue = getOfflineQueue();
  queue.push(sale);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return sale;
}

export function removeQueuedSale(id: string) {
  const queue = getOfflineQueue().filter((s) => s.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function cacheCatalog(categories: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATALOG_KEY, JSON.stringify({ at: Date.now(), categories }));
}

export function getCachedCatalog<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw).categories as T;
  } catch {
    return null;
  }
}

export function cacheVariants(key: string, variants: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${VARIANTS_PREFIX}${key}`, JSON.stringify({ at: Date.now(), variants }));
}

export function getCachedVariants<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${VARIANTS_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw).variants as T;
  } catch {
    return null;
  }
}

export async function flushOfflineQueue(
  postCheckout: (payload: CheckoutPayload) => Promise<void>,
): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  let synced = 0;
  let failed = 0;
  for (const sale of queue) {
    try {
      await postCheckout({
        shop_id: sale.shop_id,
        payment_method: sale.payment_method,
        overall_discount: sale.overall_discount,
        items: sale.items,
      });
      removeQueuedSale(sale.id);
      synced++;
    } catch {
      failed++;
      break;
    }
  }
  return { synced, failed };
}
