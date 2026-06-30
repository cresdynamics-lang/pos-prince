"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUser } from "@/lib/auth";
import { useStore } from "@/lib/store-context";

type Note = {
  id: string;
  shop_id: string;
  shop_name: string;
  note_date: string;
  note: string;
  author_name: string;
};

export function DailyNotesPanel() {
  const { selectedStoreId, selectedStore } = useStore();
  const me = getUser();
  const shopId = selectedStoreId || me?.shop_id || "";
  const today = new Date().toISOString().slice(0, 10);

  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!shopId) return;
    const params = new URLSearchParams({ shop_id: shopId });
    apiFetch<{ notes: Note[] }>(`/daily-notes?${params}`)
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => setNotes([]));
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const todayNote = notes.find((n) => n.note_date === today);
    if (todayNote) setNote(todayNote.note);
  }, [notes, today]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) {
      setMsg("Select a store first");
      return;
    }
    if (!note.trim()) {
      setMsg("Write a note for the director");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/daily-notes", {
        method: "POST",
        body: JSON.stringify({ shop_id: shopId, note: note.trim(), note_date: today }),
      });
      setMsg("Note saved for today");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  if (!shopId) {
    return (
      <div className="neu-flat p-4 text-sm text-[var(--muted)]">
        Select a store to add end-of-day notes for the director.
      </div>
    );
  }

  return (
    <div className="neu-flat p-4">
      <h3 className="mb-1 text-sm font-semibold accent-text">Note for director</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        {selectedStore?.name ?? "Your store"} — today ({today}). Cash differences, issues, or anything the director
        should know.
      </p>
      <form onSubmit={save} className="space-y-3 text-sm">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. M-Pesa KES 2,000 pending confirmation. One refund issued..."
          rows={4}
          className="neu-inset w-full px-3 py-2"
        />
        <button type="submit" disabled={saving} className="neu-btn w-full py-2 accent-text">
          {saving ? "Saving…" : "Save today’s note"}
        </button>
      </form>
      {notes.length > 1 && (
        <div className="mt-4 border-t border-[var(--shadow-dark)]/20 pt-3">
          <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">Recent notes</p>
          <div className="max-h-32 space-y-2 overflow-y-auto text-xs">
            {notes
              .filter((n) => n.note_date !== today)
              .slice(0, 5)
              .map((n) => (
                <div key={n.id} className="neu-inset p-2">
                  <p className="text-[var(--muted)]">{n.note_date}</p>
                  <p className="mt-1">{n.note}</p>
                </div>
              ))}
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
