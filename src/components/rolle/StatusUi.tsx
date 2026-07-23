"use client";

import { BESTELL_STATUS_LABEL } from "@/lib/statuslogik";

// Gemeinsame Status-Visualisierung für die GANZE App (Verkauf, Kassa, Übersicht),
// damit alles durchgängig gleich aussieht. POS-Standard: auffälliger Farbbalken
// oben + Symbol + Text, Farbe nie allein.
const STATUS_INFO: Record<string, { icon: string; kopf: string }> = {
  SUBMITTED: { icon: "📤", kopf: "bg-slate-600 text-white" },
  IN_PROGRESS: { icon: "⏳", kopf: "bg-blue-600 text-white" },
  READY_FOR_PICKUP: { icon: "✅", kopf: "bg-emerald-600 text-white" },
  COLLECTED: { icon: "🛎️", kopf: "bg-indigo-600 text-white" },
  DELIVERED: { icon: "🍽️", kopf: "bg-teal-600 text-white" },
  COMPLETED: { icon: "✔️", kopf: "bg-emerald-700 text-white" },
  CANCELLED: { icon: "✖️", kopf: "bg-red-600 text-white" },
};
export function statusInfo(s: string) {
  return STATUS_INFO[s] ?? STATUS_INFO.SUBMITTED;
}
export function minutenSeit(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Vollbreiter, farbiger Status-Kopf: Symbol + Text + Wartezeit. Auf einen Blick erkennbar. */
export function StatusKopf({ status, minuten }: { status: string; minuten: number | null }) {
  const info = statusInfo(status);
  const alt = minuten != null && minuten >= 6;
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${info.kopf}`}>
      <span className="font-bold text-sm flex items-center gap-1.5">
        <span className="text-base leading-none">{info.icon}</span>
        {BESTELL_STATUS_LABEL[status] ?? status}
      </span>
      {minuten != null && (
        <span className={`text-xs font-bold tabular-nums ${alt ? "bg-black/30 rounded px-1.5 py-0.5" : "opacity-90"}`}>
          {alt ? "⏰ " : ""}
          {minuten} min
        </span>
      )}
    </div>
  );
}

/** Kompakte, farbige Status-Pille (für Tabellen/Zeilen, wo kein Kopfbalken passt). */
export function StatusPille({ status }: { status: string }) {
  const info = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${info.kopf}`}>
      <span className="leading-none">{info.icon}</span>
      {BESTELL_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Zahlungsstatus als farbige Pille. */
export function ZahlungBadge({ bezahlt }: { bezahlt: boolean }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 whitespace-nowrap ${
        bezahlt ? "bg-emerald-500/25 text-emerald-50 ring-emerald-400/50" : "bg-amber-500/25 text-amber-50 ring-amber-400/50"
      }`}
    >
      {bezahlt ? "Bezahlt ✓" : "Zahlung offen"}
    </span>
  );
}

/** Arbeitsbereich-Fortschritt als kräftig gefüllte Pille (fertig/in Arbeit). */
export function BereichChip({ name, status }: { name: string; status: string }) {
  const fertig = status === "READY" || status === "COLLECTED";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${
        fertig ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
      }`}
    >
      {fertig ? "✓" : "⏳"} {name} {fertig ? "fertig" : "in Arbeit"}
    </span>
  );
}
