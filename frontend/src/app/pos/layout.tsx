import { RequireAuth } from "@/components/RequireAuth";
import { StoreProvider } from "@/lib/store-context";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <StoreProvider>{children}</StoreProvider>
    </RequireAuth>
  );
}
