import { RequireAuth } from "@/components/RequireAuth";
import { AdminShell } from "@/components/AdminShell";
import { StoreProvider } from "@/lib/store-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <StoreProvider>
        <AdminShell>{children}</AdminShell>
      </StoreProvider>
    </RequireAuth>
  );
}
