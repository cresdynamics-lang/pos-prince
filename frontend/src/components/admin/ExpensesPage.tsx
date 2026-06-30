"use client";

import { useState } from "react";
import { DailyNotesPanel } from "@/components/admin/DailyNotesPanel";
import { ExpenseSidePanel } from "@/components/admin/ExpenseSidePanel";
import { StoreScopeBanner } from "@/components/admin/StoreScopeBanner";

export function ExpensesPageClient() {
  const [openForm, setOpenForm] = useState(false);
  const load = () => setOpenForm(false);

  return (
    <div className="space-y-6">
      <StoreScopeBanner hint="Pick the store in the header before recording expenses so totals match the bank account." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="neu-flat p-6">
            <h3 className="text-sm font-semibold accent-text">Record expenses</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Log marketing, rent, transport, and other costs for the selected store. Shop staff should record expenses
              here so revenue and bank balances stay aligned.
            </p>
            <button
              type="button"
              className="neu-btn mt-4 px-5 py-2.5 accent-text"
              onClick={() => setOpenForm(true)}
            >
              + Record expense
            </button>
          </div>
          <DailyNotesPanel />
        </div>

        <ExpenseSidePanel startOpen={openForm} onRecorded={load} />
      </div>
    </div>
  );
}
