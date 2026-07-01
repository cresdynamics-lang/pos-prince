"use client";

import { useEffect, useState } from "react";
import {
  ALL_PERMISSIONS,
  apiFetch,
  getUser,
  hasPermission,
  isSuperAdmin,
  PERMS,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";

const ROLE_DEFAULTS: Record<UserRole, string[]> = {
  director: ALL_PERMISSIONS.map((p) => p.key).filter(
    (k) => k !== "users.view" && k !== "users.create" && k !== "users.edit"
  ),
  shop_manager: ALL_PERMISSIONS.filter((p) => !p.key.startsWith("users")).map((p) => p.key),
  cashier: ["dashboard.view", "inventory.view", "sales.view", "sales.create", "pos.access"],
};

const USER_MGMT = new Set(["users.view", "users.create", "users.edit"]);

type Shop = { id: string; name: string };

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  shop_id: string;
  permissions: string[];
  is_active: boolean;
};

const emptyForm = (): UserForm => ({
  name: "",
  email: "",
  password: "",
  role: "cashier",
  shop_id: "",
  permissions: ROLE_DEFAULTS.cashier,
  is_active: true,
});

export function UsersPageClient() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [msg, setMsg] = useState("");

  const me = getUser();
  const canCreate = isSuperAdmin(me) || hasPermission(me, PERMS.usersCreate);
  const canEdit = isSuperAdmin(me) || hasPermission(me, PERMS.usersEdit);
  const canManage = canCreate || canEdit;

  function loadUsers() {
    apiFetch<{ users: AuthUser[] }>("/users")
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]));
  }

  useEffect(() => {
    loadUsers();
    apiFetch<{ shops: Shop[] }>("/shops")
      .then((d) => setShops(d.shops ?? []))
      .catch(() => {});
  }, []);

  function resetForm() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(false);
    setMsg("");
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(u: AuthUser) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      shop_id: u.shop_id ?? "",
      permissions: u.permissions.filter((p) => !USER_MGMT.has(p) || u.is_super_admin),
      is_active: u.is_active !== false,
    });
    setShowForm(true);
    setMsg("");
  }

  function togglePerm(key: string) {
    if (USER_MGMT.has(key)) return;
    if (!isSuperAdmin(me) && !me?.permissions?.includes(key)) return;
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          shop_id: form.shop_id || "",
          permissions: editing.is_super_admin
            ? undefined
            : form.permissions.filter((p) => !USER_MGMT.has(p)),
          is_active: editing.is_super_admin ? undefined : form.is_active,
        };
        if (form.password.trim()) body.password = form.password;
        await apiFetch(`/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMsg("User updated");
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            shop_id: form.shop_id || null,
            permissions: form.permissions.filter((p) => !USER_MGMT.has(p)),
          }),
        });
        setMsg("User created");
      }
      resetForm();
      loadUsers();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeUser(u: AuthUser) {
    if (u.is_super_admin) return;
    const label = u.is_active === false ? "delete" : "deactivate";
    if (!confirm(`${label === "deactivate" ? "Deactivate" : "Delete"} ${u.name}?`)) return;
    setMsg("");
    try {
      const res = await apiFetch<{ deactivated?: boolean; deleted?: boolean }>(`/users/${u.id}`, {
        method: "DELETE",
      });
      setMsg(res.deactivated ? "User deactivated" : "User deleted");
      loadUsers();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Remove failed");
    }
  }

  const editablePerms = ALL_PERMISSIONS.filter((p) => {
    if (USER_MGMT.has(p.key)) return false;
    if (isSuperAdmin(me)) return true;
    return me?.permissions?.includes(p.key) ?? false;
  });
  const editingSuperAdmin = editing?.is_super_admin;

  return (
    <div className="space-y-6">
      {!canManage && (
        <p className="text-sm text-[var(--muted)]">
          You have read-only access to the user list. Ask a director or super admin to create accounts.
        </p>
      )}

      {canCreate && (
        <button type="button" onClick={startCreate} className="neu-btn px-4 py-2 text-sm accent-text">
          + Create user
        </button>
      )}

      {showForm && (canCreate || (canEdit && editing)) && (
        <form onSubmit={handleSave} className="neu-flat space-y-4 p-6">
          <h3 className="font-semibold">{editing ? "Edit user" : "New user"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="neu-inset px-3 py-2 text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="neu-inset px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              placeholder={editing ? "New password (leave blank to keep)" : "Password (min 6)"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="neu-inset px-3 py-2 text-sm"
              required={!editing}
              minLength={editing ? undefined : 6}
            />
            {!editingSuperAdmin && (
              <>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const role = e.target.value as UserRole;
                    setForm({ ...form, role, permissions: ROLE_DEFAULTS[role] });
                  }}
                  className="neu-inset px-3 py-2 text-sm"
                >
                  <option value="director">Director</option>
                  <option value="shop_manager">Shop Manager</option>
                  <option value="cashier">Cashier</option>
                </select>
                <select
                  value={form.shop_id}
                  onChange={(e) => setForm({ ...form, shop_id: e.target.value })}
                  className="neu-inset px-3 py-2 text-sm"
                >
                  <option value="">No store assignment</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {!editingSuperAdmin && (
            <>
              <div>
                <p className="mb-2 text-xs text-[var(--muted)]">Section permissions</p>
                <div className="flex flex-wrap gap-2">
                  {editablePerms.map((p) => (
                    <label
                      key={p.key}
                      className={`neu-btn cursor-pointer px-3 py-1.5 text-xs ${
                        form.permissions.includes(p.key) ? "active accent-text" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.permissions.includes(p.key)}
                        onChange={() => togglePerm(p.key)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active account
              </label>
            </>
          )}

          {editingSuperAdmin && (
            <p className="text-xs text-[var(--muted)]">
              Super admin — full access is fixed. You can update name, email, and password only.
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" className="neu-btn px-6 py-2 text-sm font-medium accent-text">
              {editing ? "Save changes" : "Create user"}
            </button>
            <button type="button" onClick={resetForm} className="neu-btn px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="neu-flat overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--muted)]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Status</th>
              {canEdit && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const shop = shops.find((s) => s.id === u.shop_id);
              return (
                <tr key={u.id} className="border-t border-[var(--shadow-dark)]/20">
                  <td className="px-4 py-3">
                    <span className="font-medium">{u.name}</span>
                    {u.is_super_admin && (
                      <span className="ml-2 rounded bg-[var(--shadow-dark)]/10 px-2 py-0.5 text-xs accent-text">
                        Super admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{shop?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={u.is_active !== false ? "accent-text" : "text-red-700"}>
                      {u.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="neu-btn px-2 py-1 text-xs"
                          onClick={() => startEdit(u)}
                        >
                          Edit
                        </button>
                        {!u.is_super_admin && (
                          <button
                            type="button"
                            className="neu-btn px-2 py-1 text-xs text-red-700"
                            onClick={() => removeUser(u)}
                          >
                            {u.is_active !== false ? "Deactivate" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No users loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
