import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Prince Esquire POS",
  description: "Sell in-store — works offline and syncs when connected",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PE POS",
  },
};

export const viewport: Viewport = {
  themeColor: "#b8860b",
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
