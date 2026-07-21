import type { MetadataRoute } from "next";
import { getEinstellung } from "@/lib/konfiguration";

// Manifest pro Request erzeugen, damit Name/Icon dem aktuellen Branding folgen.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** MIME-Typ eines hochgeladenen Logos anhand der Dateiendung. */
function bildTyp(url: string): string | undefined {
  const u = url.toLowerCase();
  if (u.endsWith(".svg")) return "image/svg+xml";
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".webp")) return "image/webp";
  return undefined;
}

const STATISCHE_ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "POS-Kasse";
  let logoUrl: string | null = null;
  try {
    const e = await getEinstellung();
    if (e.titel?.trim()) name = e.titel.trim();
    logoUrl = e.logoUrl;
  } catch {
    /* DB evtl. noch nicht bereit (z. B. während des Builds) – Standardwerte nutzen. */
  }

  // Ist ein Branding-Logo hinterlegt, wird es als App-Icon verwendet
  // (sizes "any", da die Maße unbekannt sind – gilt für PNG/SVG/WebP).
  const icons: MetadataRoute.Manifest["icons"] = logoUrl
    ? [
        { src: logoUrl, sizes: "any", type: bildTyp(logoUrl), purpose: "any" },
        { src: logoUrl, sizes: "any", type: bildTyp(logoUrl), purpose: "maskable" },
      ]
    : STATISCHE_ICONS;

  return {
    name,
    short_name: name.length <= 12 ? name : "Kasse",
    description: "Touch-Kassensystem für Verkaufsbereiche, Kategorien und Produkte.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "de",
    categories: ["business", "productivity", "shopping"],
    icons,
    shortcuts: [
      { name: "Verkauf", url: "/kellner" },
      { name: "Kassa", url: "/kasse" },
      { name: "Administration", url: "/admin" },
    ],
  };
}
