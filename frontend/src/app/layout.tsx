import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { InstallPwaBanner, PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prince Esquire POS",
  description: "Multi-shop point of sale for Prince Esquire",
  manifest: "/manifest.webmanifest",
  applicationName: "Prince Esquire POS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PE POS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#b8860b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
