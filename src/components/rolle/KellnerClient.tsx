"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { useDialog } from "@/components/ui/DialogProvider";
import { BESTELL_STATUS_LABEL } from "@/lib/statuslogik";
import { useLive } from "@/lib/useLive";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { InstallButton } from "@/components/kasse/InstallButton";

type Kat = { id: string; name: string; farbe: string | null; icon: string | null };
type Prod = { id: string; name: string; preisCent: number; icon: string | null; bildUrl: string | null; barcode: string | null; kategorieId: string };
type Pos = { produktId: string; name: string; preisCent: number; menge: number };
type MeineBestellung = {
  id: string;
  nummer: number;
  tisch: string | null;
  gast: string | null;
  abholnummer: string | null;
  verkaeufer?: string;
  summeCent: number;
  bestellStatus: string;
  zahlungStatus: string;
  auslieferungStatus: string;
  bereiche: { name: string; status: string }[];
};

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function KellnerClient() {
  const dialog = useDialog();
  const [tab, setTab] = useState<"neu" | "meine" | "ausgabe">("neu");

  // Produkte / Warenkorb
  const [kategorien, setKategorien] = useState<Kat[]>([]);
  const [produkte, setProdukte] = useState<Prod[]>([]);
  const [katFilter, setKatFilter] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [korb, setKorb] = useState<Record<string, Pos>>({});
  const [tisch, setTisch] = useState("");
  const [gast, setGast] = useState("");
  const [notiz, setNotiz] = useState("");
  const [senden, setSenden] = useState(false);
  const clientRef = useRef(uuid());

  // Meine Bestellungen + geteilte Ausgabe-Liste
  const [meine, setMeine] = useState<MeineBestellung[]>([]);
  const [ausgabe, setAusgabe] = useState<MeineBestellung[]>([]);
  const [erledigtHeute, setErledigtHeute] = useState(0);
  const [darfZahlen, setDarfZahlen] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bezahl-Modal
  const [zahlFuer, setZahlFuer] = useState<MeineBestellung | null>(null);
  const [zahlLaedt, setZahlLaedt] = useState(false);
  const [zahlFehler, setZahlFehler] = useState<string | null>(null);
  const [sumupKey, setSumupKey] = useState<string | null>(null);

  useEffect(() => {
    jsonFetch<{ kategorien: Kat[]; produkte: Prod[] }>("/api/kellner/produkte")
      .then((d) => {
        setKategorien(d.kategorien);
        setProdukte(d.produkte);
      })
      .catch((e) => setFehler((e as Error).message));
    jsonFetch<{ sumupAffiliateKey: string | null }>("/api/kasse/konfig")
      .then((k) => setSumupKey(k.sumupAffiliateKey))
      .catch(() => undefined);
  }, []);

  const ladeMeine = useCallback(async () => {
    try {
      const d = await jsonFetch<{ bestellungen: MeineBestellung[]; erledigtHeute: number; darfZahlen: boolean }>(
        "/api/kellner/bestellungen",
      );
      setMeine(d.bestellungen);
      setErledigtHeute(d.erledigtHeute);
      setDarfZahlen(d.darfZahlen);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  const ladeAusgabe = useCallback(async () => {
    try {
      const d = await jsonFetch<{ bestellungen: MeineBestellung[] }>("/api/kellner/ausgabe");
      setAusgabe(d.bestellungen);
    } catch {
      /* Ausgabe-Liste ist ergänzend; Fehler nicht hart anzeigen */
    }
  }, []);
  const aktualisieren = useCallback(() => {
    ladeMeine();
    ladeAusgabe();
  }, [ladeMeine, ladeAusgabe]);
  useEffect(() => {
    aktualisieren();
  }, [aktualisieren]);
  useLive(aktualisieren);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return produkte.filter((p) => {
      if (katFilter && p.kategorieId !== katFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produkte, katFilter, suche]);
  const positionen = Object.values(korb);
  const summe = positionen.reduce((s, p) => s + p.preisCent * p.menge, 0);
  const anzahl = positionen.reduce((s, p) => s + p.menge, 0);

  function plus(p: Prod) {
    setKorb((k) => ({
      ...k,
      [p.id]: k[p.id]
        ? { ...k[p.id], menge: k[p.id].menge + 1 }
        : { produktId: p.id, name: p.name, preisCent: p.preisCent, menge: 1 },
    }));
  }
  function menge(id: string, d: number) {
    setKorb((k) => {
      const pos = k[id];
      if (!pos) return k;
      const m = pos.menge + d;
      if (m <= 0) {
        const rest = { ...k };
        delete rest[id];
        return rest;
      }
      return { ...k, [id]: { ...pos, menge: m } };
    });
  }

  async function absenden() {
    if (anzahl === 0 || senden) return;
    setSenden(true);
    setFehler(null);
    try {
      await jsonFetch("/api/kellner/bestellungen", {
        method: "POST",
        body: JSON.stringify({
          clientRef: clientRef.current,
          tisch: tisch.trim() || null,
          gast: gast.trim() || null,
          notiz: notiz.trim() || null,
          positionen: positionen.map((p) => ({ produktId: p.produktId, menge: p.menge })),
        }),
      });
      clientRef.current = uuid();
      setKorb({});
      setTisch("");
      setGast("");
      setNotiz("");
      setTab("meine");
      aktualisieren();
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setSenden(false);
    }
  }

  async function aktion(id: string, pfad: string, body?: unknown) {
    try {
      await jsonFetch(`/api/bestellungen/${id}/${pfad}`, { method: "POST", body: JSON.stringify(body ?? {}) });
      aktualisieren();
    } catch (e) {
      await dialog.alert({ titel: "Fehler", text: (e as Error).message });
    }
  }
  async function bezahlen(gegebenCent: number | null, art: string) {
    if (!zahlFuer || zahlLaedt) return;
    setZahlLaedt(true);
    setZahlFehler(null);
    try {
      await jsonFetch(`/api/bestellungen/${zahlFuer.id}/zahlung`, {
        method: "POST",
        body: JSON.stringify({ gegebenCent, art }),
      });
      setZahlFuer(null);
      aktualisieren();
    } catch (e) {
      setZahlFehler((e as Error).message);
    } finally {
      setZahlLaedt(false);
    }
  }
  async function ausgeben(b: MeineBestellung) {
    const offene = b.bereiche.filter((a) => a.status !== "READY" && a.status !== "COLLECTED");
    if (offene.length > 0) {
      const ok = await dialog.confirm({
        titel: `Nr. ${b.nummer} ohne Zubereitung ausgeben?`,
        text: `Noch nicht fertig gemeldet: ${offene.map((a) => a.name).join(", ")}. Trotzdem ausgeben?`,
        bestaetigenText: "Ausgeben",
      });
      if (!ok) return;
    }
    aktion(b.id, "ausgeben");
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RollenHeader titel="Verkauf">
        <div className="flex gap-1">
          <button className={`pill-tab ${tab === "neu" ? "on" : ""}`} onClick={() => setTab("neu")}>
            Neue Bestellung
          </button>
          <button className={`pill-tab ${tab === "meine" ? "on" : ""}`} onClick={() => setTab("meine")}>
            Meine ({meine.length})
          </button>
          <button className={`pill-tab ${tab === "ausgabe" ? "on" : ""}`} onClick={() => setTab("ausgabe")}>
            Ausgabe ({ausgabe.length})
          </button>
        </div>
        <InstallButton />
      </RollenHeader>

      {fehler && <p className="text-red-300 text-sm px-3 pt-2">{fehler}</p>}

      {tab === "neu" && (
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 min-w-0 flex flex-col">
            <div className="shrink-0 p-3 border-b border-neutral-800 space-y-2">
              <input
                type="search"
                className="input"
                placeholder="Produkt suchen oder Barcode scannen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const code = suche.trim();
                  if (!code) return;
                  // Barcode-Scanner tippt den Code + Enter: exakter Treffer -> in den Korb.
                  const treffer = produkte.find((p) => p.barcode && p.barcode === code);
                  if (treffer) {
                    plus(treffer);
                    setSuche("");
                  }
                }}
              />
              <div className="flex gap-2 overflow-x-auto">
                <button className={`chip-cat ${!katFilter ? "on" : ""}`} onClick={() => setKatFilter(null)}>
                  Alle
                </button>
                {kategorien.map((k) => (
                  <button key={k.id} className={`chip-cat ${katFilter === k.id ? "on" : ""}`} onClick={() => setKatFilter(k.id)}>
                    {k.icon} {k.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {gefiltert.map((p) => (
                  <div
                    key={p.id}
                    className={`card p-0 overflow-hidden flex flex-col ${korb[p.id] ? "ring-2 ring-brand-600 border-brand-600" : ""}`}
                  >
                    {/* Großes Produktbild (oder Icon) – antippen legt in den Korb. */}
                    <button onClick={() => plus(p)} className="text-left active:scale-[.98] transition">
                      <div className="relative aspect-[4/3] bg-neutral-800 flex items-center justify-center">
                        {p.bildUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.bildUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <span className="text-4xl leading-none">{p.icon || "🍽️"}</span>
                        )}
                        {korb[p.id] && (
                          <span className="absolute top-1 right-1 badge bg-brand-600 text-white shadow">{korb[p.id].menge}×</span>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="font-medium leading-tight line-clamp-2">{p.name}</div>
                        <div className="mt-0.5 text-brand-50 font-semibold tabular-nums">{formatCent(p.preisCent)}</div>
                      </div>
                    </button>
                    {/* Menge direkt an der Kachel anpassen. */}
                    <div className="mt-auto flex items-center gap-1 p-1.5 border-t border-neutral-800">
                      <button
                        onClick={() => menge(p.id, -1)}
                        disabled={!korb[p.id]}
                        aria-label={`${p.name}: Menge verringern`}
                        className="h-10 flex-1 rounded-lg bg-neutral-800 text-xl font-semibold active:bg-neutral-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums font-semibold" aria-live="polite">
                        {korb[p.id]?.menge ?? 0}
                      </span>
                      <button
                        onClick={() => plus(p)}
                        aria-label={`${p.name}: Menge erhöhen`}
                        className="h-10 flex-1 rounded-lg bg-brand-600 text-white text-xl font-semibold active:bg-brand-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {gefiltert.length === 0 && <p className="text-neutral-400 col-span-full p-4">Keine Produkte mit Preis.</p>}
              </div>
            </div>
          </main>

          <aside className="w-80 shrink-0 border-l border-neutral-800 flex flex-col">
            <div className="p-3 border-b border-neutral-800 space-y-2">
              <input className="input" placeholder="Tisch / Abholnr." value={tisch} onChange={(e) => setTisch(e.target.value)} />
              <input className="input" placeholder="Gast (optional)" value={gast} onChange={(e) => setGast(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {positionen.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center p-4">Produkte antippen …</p>
              ) : (
                positionen.map((p) => (
                  <div key={p.produktId} className="card p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-400 tabular-nums">
                        {formatCent(p.preisCent)} × {p.menge}
                      </div>
                    </div>
                    <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => menge(p.produktId, -1)}>–</button>
                    <span className="w-6 text-center tabular-nums">{p.menge}</span>
                    <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => menge(p.produktId, +1)}>+</button>
                  </div>
                ))
              )}
              {positionen.length > 0 && (
                <input className="input" placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
              )}
            </div>
            <div className="shrink-0 border-t border-neutral-800 p-3 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-300">Gesamt</span>
                <span className="text-xl font-bold tabular-nums">{formatCent(summe)}</span>
              </div>
              <button className="btn-primary w-full" onClick={absenden} disabled={anzahl === 0 || senden}>
                {senden ? "Sende …" : `Bestellung absenden (${anzahl})`}
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === "meine" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Übersicht: Kennzahlen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Offen" wert={meine.length} />
            <Kpi label="Abholbereit" wert={meine.filter((b) => b.auslieferungStatus === "READY_FOR_PICKUP").length} akzent />
            <Kpi label="Zahlung offen" wert={meine.filter((b) => b.zahlungStatus !== "PAID").length} />
            <Kpi label="Heute erledigt" wert={erledigtHeute} />
          </div>

          {meine.length === 0 && (
            <p className="text-neutral-400 text-center py-8">Keine offenen Bestellungen. 🎉</p>
          )}
          {meine.map((b) => {
            const bereit = b.auslieferungStatus === "READY_FOR_PICKUP";
            const abgeholt = b.auslieferungStatus === "COLLECTED";
            const ausgeliefert = b.auslieferungStatus === "DELIVERED";
            const bezahlt = b.zahlungStatus === "PAID";
            return (
              <div key={b.id} className={`card p-3 border-l-4 ${bereit ? "border-brand-600" : abgeholt ? "border-blue-500" : "border-neutral-700"}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold">
                    Nr. {b.nummer}
                    {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                    {b.gast ? ` · ${b.gast}` : ""}
                  </span>
                  <span className={`badge ${bereit ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}>
                    {BESTELL_STATUS_LABEL[b.bestellStatus] ?? b.bestellStatus}
                  </span>
                </div>
                {b.bereiche.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.bereiche.map((a, i) => (
                      <span
                        key={i}
                        className={`text-xs rounded px-1.5 py-0.5 border ${
                          a.status === "READY" || a.status === "COLLECTED"
                            ? "border-brand-600/50 text-brand-50"
                            : "border-blue-500/50 text-blue-200"
                        }`}
                      >
                        {a.name}
                        {a.status === "READY" || a.status === "COLLECTED" ? " ✓" : " …"}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-neutral-400 tabular-nums">
                    {formatCent(b.summeCent)} · {bezahlt ? "bezahlt ✓" : "Zahlung offen"}
                    {ausgeliefert ? " · ausgeliefert ✓" : ""}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {!bezahlt && darfZahlen && (
                      <button
                        className="btn-ghost py-1.5 text-sm"
                        onClick={() => {
                          setZahlFehler(null);
                          setZahlFuer(b);
                        }}
                      >
                        Kassieren
                      </button>
                    )}
                    {!ausgeliefert && (
                      <button className="btn-primary py-1.5 text-sm" onClick={() => ausgeben(b)}>
                        Ausgeben
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "ausgabe" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-sm text-neutral-400">
            Abholbereite Bestellungen – jeder Kellner kann sie ausgeben (holen &amp; zum Tisch bringen).
          </p>
          {ausgabe.length === 0 && (
            <p className="text-neutral-400 text-center py-8">Nichts abholbereit. 🎉</p>
          )}
          {ausgabe.map((b) => {
            const bezahlt = b.zahlungStatus === "PAID";
            return (
              <div key={b.id} className="card p-3 border-l-4 border-brand-600">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold">
                    Nr. {b.nummer}
                    {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                    {b.gast ? ` · ${b.gast}` : ""}
                  </span>
                  <span className="badge bg-brand-600/20 text-brand-50">Abholbereit</span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  Aufgenommen von {b.verkaeufer ?? "—"} · {formatCent(b.summeCent)} · {bezahlt ? "bezahlt ✓" : "Zahlung offen"}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap justify-end">
                  {!bezahlt && darfZahlen && (
                    <button
                      className="btn-ghost py-1.5 text-sm"
                      onClick={() => {
                        setZahlFehler(null);
                        setZahlFuer(b);
                      }}
                    >
                      Kassieren
                    </button>
                  )}
                  <button className="btn-primary py-1.5 text-sm" onClick={() => ausgeben(b)}>
                    Ausgeben
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zahlFuer && (
        <ZahlModal
          nummer={zahlFuer.nummer}
          summeCent={zahlFuer.summeCent}
          laedt={zahlLaedt}
          fehler={zahlFehler}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setZahlFuer(null)}
          onBezahlen={bezahlen}
        />
      )}
    </div>
  );
}

function Kpi({ label, wert, akzent }: { label: string; wert: number; akzent?: boolean }) {
  return (
    <div className="card p-2 text-center">
      <div className={`text-2xl font-bold tabular-nums ${akzent && wert > 0 ? "text-brand-50" : ""}`}>{wert}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
