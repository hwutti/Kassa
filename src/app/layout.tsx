import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaController } from "@/components/PwaController";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { ThemeApplier } from "@/components/ThemeApplier";
import { getEinstellung } from "@/lib/konfiguration";

export const dynamic = "force-dynamic";

/** MIME-Typ eines hochgeladenen Logos anhand der Dateiendung (für das Favicon). */
function bildTyp(url: string): string | undefined {
  const u = url.toLowerCase();
  if (u.endsWith(".svg")) return "image/svg+xml";
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".webp")) return "image/webp";
  return undefined;
}

// Favicon/Titel dynamisch aus dem Branding (Einstellung). Ist ein Logo hinterlegt,
// wird es als Tab-Icon verwendet; sonst greifen die statischen Standard-Icons.
export async function generateMetadata(): Promise<Metadata> {
  let titel = "POS-Kasse";
  let logoUrl: string | null = null;
  try {
    const e = await getEinstellung();
    if (e.titel?.trim()) titel = e.titel.trim();
    logoUrl = e.logoUrl;
  } catch {
    /* DB evtl. noch nicht bereit (z. B. während des Builds) – Standardwerte nutzen. */
  }

  const icon = logoUrl
    ? [{ url: logoUrl, type: bildTyp(logoUrl) }]
    : [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ];

  return {
    title: titel,
    description: "Touch-Kassensystem als installierbare PWA",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: titel,
    },
    icons: {
      icon,
      apple: [{ url: logoUrl ?? "/icons/apple-touch-icon.png" }],
    },
  };
}

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
        <ThemeApplier />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
