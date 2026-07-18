import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaController } from "@/components/PwaController";
import { DialogProvider } from "@/components/ui/DialogProvider";

export const metadata: Metadata = {
  title: "POS-Kasse",
  description: "Touch-Kassensystem als installierbare PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "POS-Kasse",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Zoom nicht sperren (Barrierefreiheit), aber sinnvolle Grenzen.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {/* Registriert den Service Worker und steuert Verbindungs-/Update-Hinweise. */}
        <PwaController />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
