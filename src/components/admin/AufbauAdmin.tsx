"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { ROLLEN, ROLLEN_LABEL, type Rolle } from "@/lib/rollen";

type Benutzer = {
  id: string;
  benutzername: string;
  anzeigename: string | null;
  rolle: string;
  darfZahlen: boolean;
  darfStornieren: boolean;
  aktiv: boolean;
  arbeitsbereichIds: string[];
};
type Bereich = { id: string; name: string; icon: string | null; aktiv: boolean };

type FormState = {
  id?: string;
  benutzername: string;
  anzeigename: string;
  rolle: Rolle;
  passwort: string;
  darfZahlen: boolean;
  darfStornieren: boolean;
  aktiv: boolean;
  arbeitsbereichIds: string[];
};

const ROLLE_ICON: Record<string, string> = {
  ADMIN: "🛠️",
  SUPERVISOR: "👁️",
  KELLNER: "🧑‍🍳",
  KASSA: "💶",
  BEREICH: "🍺",
};

export function AufbauAdmin() {
  const dialog = useDialog();
  const [benutzer, setBenutzer] = useState<Benutzer[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [speichern, setSpeichern] = useState(false);
  const [ansicht, setAnsicht] = useState<"plan" | "liste">("plan");

  const laden = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([
        jsonFetch<Benutzer[]>("/api/admin/benutzer"),
        jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche"),
      ]);
      setBenutzer(b);
      setBereiche(a);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  useEffect(() => {
    laden();
  }, [laden]);

  const kellner = useMemo(() => benutzer.filter((b) => b.rolle === "KELLNER"), [benutzer]);
  const kassa = useMemo(() => benutzer.filter((b) => b.rolle === "KASSA"), [benutzer]);
  const leitung = useMemo(() => benutzer.filter((b) => b.rolle === "ADMIN" || b.rolle === "SUPERVISOR"), [benutzer]);
  const bereichslos = useMemo(
    () => benutzer.filter((b) => b.rolle === "BEREICH" && b.arbeitsbereichIds.length === 0),
    [benutzer],
  );

  function neu(prefill?: Partial<FormState>) {
    setForm({
      benutzername: "",
      anzeigename: "",
      rolle: "KELLNER",
      passwort: "",
      darfZahlen: false,
      darfStornieren: false,
      aktiv: true,
      arbeitsbereichIds: [],
      ...prefill,
    });
  }
  function bearbeiten(b: Benutzer) {
    setForm({
      id: b.id,
      benutzername: b.benutzername,
      anzeigename: b.anzeigename ?? "",
      rolle: b.rolle as Rolle,
      passwort: "",
      darfZahlen: b.darfZahlen,
      darfStornieren: b.darfStornieren,
      aktiv: b.aktiv,
      arbeitsbereichIds: b.arbeitsbereichIds,
    });
  }

  async function speichernForm() {
    if (!form) return;
    if (!form.benutzername.trim()) {
      setFehler("Benutzername (Login) ist erforderlich.");
      return;
    }
    if (!form.id && form.passwort.length < 4) {
      setFehler("Bitte ein Passwort (mind. 4 Zeichen) vergeben.");
      return;
    }
    setSpeichern(true);
    setFehler(null);
    const body: Record<string, unknown> = {
      benutzername: form.benutzername.trim(),
      anzeigename: form.anzeigename.trim() || null,
      rolle: form.rolle,
      darfZahlen: form.darfZahlen,
      darfStornieren: form.darfStornieren,
      aktiv: form.aktiv,
      arbeitsbereichIds: form.arbeitsbereichIds,
    };
    if (form.passwort) body.passwort = form.passwort;
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/benutzer/${form.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await jsonFetch("/api/admin/benutzer", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setSpeichern(false);
    }
  }

  async function loeschen() {
    if (!form?.id) return;
    const ok = await dialog.confirm({
      titel: "Person löschen",
      text: `„${form.anzeigename || form.benutzername}" wirklich löschen?`,
      bestaetigenText: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/benutzer/${form.id}`, { method: "DELETE" });
      setForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-neutral-400 flex-1 min-w-[14rem]">
          So ist euer Fest aufgebaut. Auf einen Platz tippen, um Login, Bezeichnung, Funktion und Bereich zu ändern.
        </p>
        <div className="flex gap-1">
          <button className={`pill-tab ${ansicht === "plan" ? "on" : ""}`} onClick={() => setAnsicht("plan")}>
            Plan
          </button>
          <button className={`pill-tab ${ansicht === "liste" ? "on" : ""}`} onClick={() => setAnsicht("liste")}>
            Liste
          </button>
        </div>
        <button className="btn-primary" onClick={() => neu()}>
          + Person
        </button>
      </div>

      {/* Ablauf-Legende */}
      <div className="card p-3 flex items-center justify-center gap-2 text-sm flex-wrap text-neutral-300">
        <span className="font-medium">🧑‍🍳 Verkauf</span>
        <span className="text-neutral-500">→</span>
        <span className="font-medium">🍺 Arbeitsbereiche</span>
        <span className="text-neutral-500">→</span>
        <span className="font-medium">💶 Kassa</span>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      {ansicht === "plan" && (
        <PlanAnsicht benutzer={benutzer} bereiche={bereiche} onPerson={bearbeiten} onNeu={neu} />
      )}

      {ansicht === "liste" && (
      <>
      {/* Zone: Verkauf */}
      <Zone titel="Verkauf (Kellner)" icon="🧑‍🍳" hinweis="nehmen Bestellungen auf">
        {kellner.map((b) => (
          <PersonKarte key={b.id} b={b} onClick={() => bearbeiten(b)} />
        ))}
        {kellner.length === 0 && <LeerHinweis text="Noch kein Verkäufer angelegt." />}
      </Zone>

      {/* Zone: Arbeitsbereiche */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🍺</span>
          <h2 className="font-semibold">Arbeitsbereiche (Zubereitung / Ausgabe)</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bereiche.map((bereich) => {
            const leute = benutzer.filter((b) => b.rolle === "BEREICH" && b.arbeitsbereichIds.includes(bereich.id));
            return (
              <div key={bereich.id} className={`card p-3 ${bereich.aktiv ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{bereich.icon || "🏭"}</span>
                  <span className="font-medium">{bereich.name}</span>
                  {!bereich.aktiv && <span className="badge bg-neutral-700 text-neutral-300 text-xs">inaktiv</span>}
                  <span className="ml-auto text-xs text-neutral-500">{leute.length} Pers.</span>
                </div>
                <div className="space-y-1.5">
                  {leute.map((b) => (
                    <PersonKarte key={b.id} b={b} kompakt onClick={() => bearbeiten(b)} />
                  ))}
                  {leute.length === 0 && <LeerHinweis text="Niemand zugeteilt" />}
                </div>
              </div>
            );
          })}
          {bereiche.length === 0 && (
            <LeerHinweis text="Noch keine Arbeitsbereiche – bitte im Menü Arbeitsbereiche anlegen." />
          )}
        </div>
        {bereichslos.length > 0 && (
          <div className="card p-3 mt-3 border-amber-500/40">
            <div className="text-sm text-amber-300 mb-2">⚠️ Bereichspersonal ohne Zuteilung (sieht keine Tickets):</div>
            <div className="flex flex-wrap gap-2">
              {bereichslos.map((b) => (
                <PersonKarte key={b.id} b={b} kompakt onClick={() => bearbeiten(b)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone: Kassa + Leitung */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Zone titel="Kassa" icon="💶" hinweis="kassiert offene Bestellungen">
          {kassa.map((b) => (
            <PersonKarte key={b.id} b={b} onClick={() => bearbeiten(b)} />
          ))}
          {kassa.length === 0 && <LeerHinweis text="Keine zentrale Kassa (Kellner kassieren selbst)." />}
        </Zone>
        <Zone titel="Leitung" icon="🛠️" hinweis="Administration / Aufsicht">
          {leitung.map((b) => (
            <PersonKarte key={b.id} b={b} onClick={() => bearbeiten(b)} />
          ))}
        </Zone>
      </div>
      </>
      )}

      {form && (
        <PersonEditor
          form={form}
          setForm={setForm}
          bereiche={bereiche}
          speichern={speichern}
          onSpeichern={speichernForm}
          onLoeschen={form.id ? loeschen : undefined}
          onAbbrechen={() => {
            setForm(null);
            setFehler(null);
          }}
        />
      )}
    </div>
  );
}

function Zone({ titel, icon, hinweis, children }: { titel: string; icon: string; hinweis: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold">{titel}</h2>
        <span className="text-xs text-neutral-500">· {hinweis}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function LeerHinweis({ text }: { text: string }) {
  return <p className="text-sm text-neutral-500 italic">{text}</p>;
}

type SitzFarbe = "kellner" | "bereich" | "kassa" | "leitung";
const SITZ_STIL: Record<SitzFarbe, string> = {
  kellner: "bg-brand-600/20 border-brand-600/50 text-brand-50",
  bereich: "bg-blue-500/15 border-blue-500/50 text-blue-100",
  kassa: "bg-amber-500/15 border-amber-500/50 text-amber-100",
  leitung: "bg-neutral-700/40 border-neutral-600 text-neutral-200",
};

/** Grafische „Sitzplan"-Ansicht (Kino-Stil): Reihen mit Plätzen je Rolle/Bereich. */
function PlanAnsicht({
  benutzer,
  bereiche,
  onPerson,
  onNeu,
}: {
  benutzer: Benutzer[];
  bereiche: Bereich[];
  onPerson: (b: Benutzer) => void;
  onNeu: (prefill?: Partial<FormState>) => void;
}) {
  const kellner = benutzer.filter((b) => b.rolle === "KELLNER");
  const kassa = benutzer.filter((b) => b.rolle === "KASSA");
  const leitung = benutzer.filter((b) => b.rolle === "ADMIN" || b.rolle === "SUPERVISOR");

  return (
    <div className="space-y-3">
      {/* „Bühne" – der Gast, dem alles zufließt */}
      <div className="mx-auto max-w-sm text-center rounded-xl border border-neutral-700 bg-neutral-800/50 py-1.5 text-xs tracking-wide text-neutral-400">
        AUSGABE · GAST
      </div>

      <PlanReihe titel="Verkauf (Kellner)">
        {kellner.map((b, i) => (
          <Seat key={b.id} b={b} farbe="kellner" nummer={i + 1} onClick={() => onPerson(b)} />
        ))}
        <AddSeat onClick={() => onNeu({ rolle: "KELLNER" })} />
      </PlanReihe>

      {bereiche.map((ab) => {
        const leute = benutzer.filter((b) => b.rolle === "BEREICH" && b.arbeitsbereichIds.includes(ab.id));
        return (
          <PlanReihe key={ab.id} titel={`${ab.icon || "🏭"} ${ab.name}`} gedimmt={!ab.aktiv}>
            {leute.map((b, i) => (
              <Seat key={b.id} b={b} farbe="bereich" nummer={i + 1} onClick={() => onPerson(b)} />
            ))}
            <AddSeat onClick={() => onNeu({ rolle: "BEREICH", arbeitsbereichIds: [ab.id] })} />
          </PlanReihe>
        );
      })}

      <div className="grid gap-3 sm:grid-cols-2">
        <PlanReihe titel="💶 Kassa">
          {kassa.map((b, i) => (
            <Seat key={b.id} b={b} farbe="kassa" nummer={i + 1} onClick={() => onPerson(b)} />
          ))}
          <AddSeat onClick={() => onNeu({ rolle: "KASSA", darfZahlen: true })} />
        </PlanReihe>
        <PlanReihe titel="🛠️ Leitung">
          {leitung.map((b, i) => (
            <Seat key={b.id} b={b} farbe="leitung" nummer={i + 1} onClick={() => onPerson(b)} />
          ))}
        </PlanReihe>
      </div>
    </div>
  );
}

function PlanReihe({ titel, gedimmt, children }: { titel: string; gedimmt?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card p-3 ${gedimmt ? "opacity-60" : ""}`}>
      <div className="text-sm font-medium mb-2">{titel}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Seat({ b, farbe, nummer, onClick }: { b: Benutzer; farbe: SitzFarbe; nummer: number; onClick: () => void }) {
  const kuerzel = (b.anzeigename || b.benutzername).slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      title={`${b.anzeigename || b.benutzername} (@${b.benutzername})`}
      className={`w-[74px] shrink-0 rounded-lg border p-1.5 text-center transition hover:brightness-125 ${SITZ_STIL[farbe]} ${b.aktiv ? "" : "opacity-50"}`}
    >
      <div className="mx-auto h-8 w-8 rounded-md flex items-center justify-center text-sm font-semibold bg-black/25">
        {kuerzel}
      </div>
      <div className="mt-1 text-[11px] leading-tight truncate">{b.anzeigename || `Platz ${nummer}`}</div>
    </button>
  );
}

function AddSeat({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Person hinzufügen"
      className="w-[74px] h-[68px] shrink-0 rounded-lg border border-dashed border-neutral-600 text-neutral-500 flex flex-col items-center justify-center transition hover:border-brand-600 hover:text-brand-50"
    >
      <span className="text-xl leading-none">+</span>
      <span className="text-[11px]">frei</span>
    </button>
  );
}

function PersonKarte({ b, onClick, kompakt }: { b: Benutzer; onClick: () => void; kompakt?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition hover:border-brand-600 ${
        b.aktiv ? "border-neutral-700 bg-neutral-800/60" : "border-neutral-800 bg-neutral-900 opacity-60"
      } ${kompakt ? "w-full" : "min-w-[9rem]"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{ROLLE_ICON[b.rolle] ?? "👤"}</span>
        <div className="min-w-0">
          <div className="font-medium truncate">{b.anzeigename || b.benutzername}</div>
          <div className="text-xs text-neutral-400 truncate">@{b.benutzername}</div>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="badge bg-neutral-700 text-neutral-200 text-[11px]">{ROLLEN_LABEL[b.rolle as Rolle] ?? b.rolle}</span>
        {b.darfZahlen && <span className="text-[11px]" title="darf kassieren">💶</span>}
        {b.darfStornieren && <span className="text-[11px]" title="darf stornieren">↩️</span>}
        {!b.aktiv && <span className="badge bg-neutral-700 text-neutral-400 text-[11px]">inaktiv</span>}
      </div>
    </button>
  );
}

function PersonEditor({
  form,
  setForm,
  bereiche,
  speichern,
  onSpeichern,
  onLoeschen,
  onAbbrechen,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  bereiche: Bereich[];
  speichern: boolean;
  onSpeichern: () => void;
  onLoeschen?: () => void;
  onAbbrechen: () => void;
}) {
  function toggleBereich(id: string) {
    const drin = form.arbeitsbereichIds.includes(id);
    setForm({
      ...form,
      arbeitsbereichIds: drin ? form.arbeitsbereichIds.filter((x) => x !== id) : [...form.arbeitsbereichIds, id],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 space-y-3">
        <h2 className="text-lg font-semibold">{form.id ? "Person bearbeiten" : "Neue Person"}</h2>

        <label className="block">
          <span className="text-sm text-neutral-400">Bezeichnung (Anzeigename)</span>
          <input
            className="input mt-1"
            value={form.anzeigename}
            onChange={(e) => setForm({ ...form, anzeigename: e.target.value })}
            placeholder="z. B. Bierausgabe Zelt 1"
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-400">Login (Benutzername)</span>
          <input
            className="input mt-1"
            value={form.benutzername}
            onChange={(e) => setForm({ ...form, benutzername: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-400">Funktion (Rolle)</span>
          <select
            className="input mt-1"
            value={form.rolle}
            onChange={(e) => setForm({ ...form, rolle: e.target.value as Rolle })}
          >
            {ROLLEN.map((r) => (
              <option key={r} value={r}>
                {ROLLE_ICON[r]} {ROLLEN_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-neutral-400">
            {form.id ? "Neues Passwort (leer = unverändert)" : "Passwort (mind. 4 Zeichen)"}
          </span>
          <input
            type="password"
            className="input mt-1"
            value={form.passwort}
            onChange={(e) => setForm({ ...form, passwort: e.target.value })}
            autoComplete="new-password"
          />
        </label>

        {/* Funktions-Rechte */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand-600 h-4 w-4"
              checked={form.darfZahlen}
              onChange={(e) => setForm({ ...form, darfZahlen: e.target.checked })}
            />
            <span className="text-sm">darf kassieren 💶</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand-600 h-4 w-4"
              checked={form.darfStornieren}
              onChange={(e) => setForm({ ...form, darfStornieren: e.target.checked })}
            />
            <span className="text-sm">darf stornieren ↩️</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand-600 h-4 w-4"
              checked={form.aktiv}
              onChange={(e) => setForm({ ...form, aktiv: e.target.checked })}
            />
            <span className="text-sm">aktiv</span>
          </label>
        </div>

        {/* Arbeitsbereiche (nur sinnvoll für Bereichspersonal) */}
        {form.rolle === "BEREICH" && (
          <div>
            <span className="text-sm text-neutral-400">Zugeteilte Arbeitsbereiche</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {bereiche.map((a) => {
                const drin = form.arbeitsbereichIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleBereich(a.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      drin ? "bg-brand-600 border-brand-600 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-200"
                    }`}
                  >
                    {a.icon || "🏭"} {a.name}
                  </button>
                );
              })}
              {bereiche.length === 0 && (
                <span className="text-sm text-amber-300">Noch keine Arbeitsbereiche angelegt.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {onLoeschen && (
            <button className="btn-ghost text-red-300" onClick={onLoeschen} disabled={speichern}>
              Löschen
            </button>
          )}
          <button className="btn-ghost ml-auto" onClick={onAbbrechen} disabled={speichern}>
            Abbrechen
          </button>
          <button className="btn-primary" onClick={onSpeichern} disabled={speichern}>
            {speichern ? "Speichere …" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
