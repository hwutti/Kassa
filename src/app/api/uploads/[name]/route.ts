import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPEN: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * GET /api/uploads/[name] – liefert hochgeladene Bilder von der Platte aus.
 * Nötig, weil Next.js im Produktionsbetrieb nur zur Build-Zeit vorhandene
 * public/-Dateien ausliefert; zur Laufzeit hochgeladene Bilder sonst 404.
 * `/uploads/*` wird per Rewrite (next.config) hierher geleitet.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Nur einfache Dateinamen zulassen (kein Pfad-Traversal).
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
    return new Response("Nicht gefunden", { status: 404 });
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const typ = TYPEN[ext];
  if (!typ) return new Response("Nicht gefunden", { status: 404 });

  try {
    const datei = path.join(process.cwd(), "public", "uploads", name);
    const buf = await readFile(datei);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": typ, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
}
