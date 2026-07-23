"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { StatusPille, ZahlungBadge, BereichChip } from "@/components/rolle/StatusUi";
import { Kpi } from "@/components/ui/Kpi";
import { LiveBadge } from "@/components/ui/Badge";
import { useLive } from "@/lib/useLive";
import { minutenSeit } from "@/lib/zeit";

type Bestellung = {
  id: string;
  nummer: number;
  tisch: string | null;
  abholnummer: string | null;
  kellner: string;
  summeCent: number;
  bestellStatus: string;
  zahlungStatus: string;
  auslieferungStatus: string;
  createdAt: string;
  bereiche: { name: string; status: string }[];
};
type Daten = {
  kpi: { offen: number; abholbereit: number; inArbeit: number; zahlungOffen: number };
  bestellungen: Bestellung[];
};

export function UebersichtClient() {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      setDaten(await jsonFetch<Daten>("/api/uebersicht"));
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  useEffect(() => {
    laden();
  }, [laden]);
  useLive(laden);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RollenHeader titel="Globale Übersicht">
        <LiveBadge />
      </RollenHeader>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
        {daten && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Offen" wert={daten.kpi.offen} />
              <Kpi label="Abholbereit" wert={daten.kpi.abholbereit} ton="gut" />
              <Kpi label="In Arbeit" wert={daten.kpi.inArbeit} />
              <Kpi label="Zahlung offen" wert={daten.kpi.zahlungOffen} ton="warnung" />
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-neutral-800">
                    <th className="py-2 px-3">Nr.</th>
                    <th className="py-2 px-3">Kellner</th>
                    <th className="py-2 px-3">Tisch/Abhol</th>
                    <th className="py-2 px-3">Bereiche</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Zahlung</th>
                    <th className="py-2 px-3 text-right">Betrag</th>
                    <th className="py-2 px-3 text-right">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {daten.bestellungen.map((b) => {
                    const alt = minutenSeit(b.createdAt) ?? 0;
                    return (
                      <tr key={b.id} className="border-b border-neutral-900">
                        <td className="py-2 px-3 font-semibold">{b.nummer}</td>
                        <td className="py-2 px-3">{b.kellner}</td>
                        <td className="py-2 px-3 text-neutral-400">{b.tisch ?? b.abholnummer ?? "—"}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {b.bereiche.length === 0 && <span className="text-neutral-500">—</span>}
                            {b.bereiche.map((a, i) => (
                              <BereichChip key={i} name={a.name} status={a.status} />
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <StatusPille status={b.bestellStatus} />
                        </td>
                        <td className="py-2 px-3">
                          <ZahlungBadge bezahlt={b.zahlungStatus === "PAID"} />
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatCent(b.summeCent)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${alt >= 8 ? "text-red-300 font-bold" : "text-neutral-400"}`}>
                          {alt} min{alt >= 8 ? " ⚠" : ""}
                        </td>
                      </tr>
                    );
                  })}
                  {daten.bestellungen.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 px-3 text-neutral-400">
                        Keine offenen Bestellungen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
