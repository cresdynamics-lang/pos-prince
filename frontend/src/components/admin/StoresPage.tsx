"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUser, hasPermission, PERMS } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

type Store = {
  id: string;
  name: string;
  location?: string | null;
  phone?: string | null;
  manager_id?: string | null;
  is_active: boolean;
};

type UserOption = { id: string; name: string };

export function StoresPageClient() {
  const { refreshStores } = useStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [managers, setManagers] = useState<UserOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [msg, setMsg] = useState("");

  const me = getUser();
  const canEdit = hasPermission(me, PERMS.storesEdit);

  const load = useCallback(() => {
    apiFetch<{ shops: Store[] }>("/shops?include_inactive=1")
      .then((d) => setStores(d.shops ?? []))
      .catch(() => setStores([]));
  }, []);

  useEffect(() => {
    load();
    apiFetch<{ users: { id: string; name: string; role: string }[] }>("/users")
      .then((d) => {
        const opts = (d.users ?? []).filter((u) => u.role === "shop_manager" || u.role === "director");
        setManagers(opts.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, [load]);

  function resetForm() {
    setName("");
    setLocation("");
    setPhone("");
    setManagerId("");
    setIsActive(true);
    setEditing(null);
    setMsg("");
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(s: Store) {
    setEditing(s);
    setName(s.name);
    setLocation(s.location ?? "");
    setPhone(s.phone ?? "");
    setManagerId(s.manager_id ?? "");
    setIsActive(s.is_active);
    setShowForm(true);
    setMsg("");
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMsg("Store name is required");
      return;
    }
    setMsg("");
    try {
      if (editing) {
        await apiFetch(`/shops/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            location: location.trim(),
            phone: phone.trim(),
            manager_id: managerId || "",
            is_active: isActive,
          }),
        });
        setMsg("Store updated");
      } else {
        await apiFetch("/shops", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            location: location.trim(),
            phone: phone.trim(),
            manager_id: managerId || undefined,
          }),
        });
        setMsg("Store created");
      }
      closeForm();
      load();
      refreshStores();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(s: Store) {
    if (!confirm(`Remove "${s.name}"? Stores with sales history are deactivated instead.`)) return;
    try {
      await apiFetch(`/shops/${s.id}`, { method: "DELETE" });
      load();
      refreshStores();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((shop) => (
            <div key={shop.id} className="neu-flat p-6">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold accent-text">{shop.name}</h3>
                <span className={shop.is_active ? "text-xs accent-text" : "text-xs text-red-700"}>
                  {shop.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{shop.location || "No location set"}</p>
              <p className="text-sm">{shop.phone || "—"}</p>
              {canEdit && (
                <div className="mt-4 flex gap-2">
                  <button type="button" className="neu-btn px-3 py-1.5 text-xs" onClick={() => startEdit(shop)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="neu-btn px-3 py-1.5 text-xs text-red-700"
                    onClick={() => remove(shop)}
                  >
                    {shop.is_active ? "Deactivate" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {stores.length === 0 && (
          <p className="text-sm text-[var(--muted)]">No stores yet. Add your first store using the panel.</p>
        )}
        {msg && !showForm && <p className="text-xs text-[var(--muted)]">{msg}</p>}
      </div>

      <aside className="sticky top-4 max-h-[calc(100vh-10rem)] self-start overflow-y-auto neu-flat p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold accent-text">Stores</h3>
          {canEdit && (
            <button type="button" className="neu-btn px-3 py-1.5 text-sm accent-text" onClick={startCreate}>
              + New store
            </button>
          )}
        </div>

        {!showForm ? (
          <p className="text-sm text-[var(--muted)]">
            Each store has its own dashboard, sales, inventory, and closing stock. Select a store at the top of the
            admin panel to filter results, or choose <strong>All stores</strong> for grand totals.
          </p>
        ) : (
          <form onSubmit={save} className="space-y-3 text-sm">
            <p className="text-xs font-medium text-[var(--muted)]">{editing ? `Editing: ${editing.name}` : "New store"}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Store name"
              className="neu-inset w-full px-3 py-2"
              required
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="neu-inset w-full px-3 py-2"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="neu-inset w-full px-3 py-2"
            />
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="neu-inset w-full px-3 py-2"
            >
              <option value="">No manager assigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {editing && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            )}
            <div className="flex gap-2">
              <button type="submit" className="neu-btn flex-1 py-2 accent-text">
                {editing ? "Save changes" : "Create store"}
              </button>
              <button type="button" onClick={closeForm} className="neu-btn px-3 py-2">
                Cancel
              </button>
            </div>
            {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
          </form>
        )}
      </aside>
    </div>
  );
}
