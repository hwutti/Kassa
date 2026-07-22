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
  hatPin: boolean;
  arbeitsbereichIds: string[];
};
type Bereich = { id: string; name: string; icon: string | null; aktiv: boolean };
type Drucker = { id: string; name: string; typ: "SYSTEM" | "NETZWERK"; ip: string | null; aktiv: boolean; arbeitsbereichId: string | null };
type DruckerForm = { id?: string; name: string; typ: "SYSTEM" | "NETZWERK"; ip: string; aktiv: boolean; arbeitsbereichId: string };

type FormState = {
  id?: string;
  benutzername: string;
  anzeigename: string;
  rolle: Rolle;
  passwort: string;
  pin: string;
  pinGesetzt: boolean;
  pinEntfernen: boolean;
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
  const [drucker, setDrucker] = useState<Drucker[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [druckerForm, setDruckerForm] = useState<DruckerForm | null>(null);
  const [speichern, setSpeichern] = useState(false);
  const [ansicht, setAnsicht] = useState<"plan" | "liste">("plan");
  const [zugaengeOffen, setZugaengeOffen] = useState(false);
  const [pins, setPins] = useState<Record<string, string>>({}); // in dieser Sitzung erzeugte Klartext-PINs
  const [konfig, setKonfig] = useState<{ titel: string; veranstaltung: string | null }>({ titel: "Zugänge", veranstaltung: null });

  const laden = useCallback(async () => {
    try {
      const [b, a, d] = await Promise.all([
        jsonFetch<Benutzer[]>("/api/admin/benutzer"),
        jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche"),
        jsonFetch<Drucker[]>("/api/admin/drucker"),
      ]);
      setBenutzer(b);
      setBereiche(a);
      setDrucker(d);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  useEffect(() => {
    laden();
  }, [laden]);

  useEffect(() => {
    jsonFetch<{ titel?: string; aktiveVeranstaltung?: { name: string } | null }>("/api/konfiguration")
      .then((k) => setKonfig({ titel: k.titel || "Zugänge", veranstaltung: k.aktiveVeranstaltung?.name ?? null }))
      .catch(() => undefined);
  }, []);

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
      pin: "",
      pinGesetzt: false,
      pinEntfernen: false,
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
      pin: "",
      pinGesetzt: b.hatPin,
      pinEntfernen: false,
      darfZahlen: b.darfZahlen,
      darfStornieren: b.darfStornieren,
      aktiv: b.aktiv,
      arbeitsbereichIds: b.arbeitsbereichIds,
    });
  }

  async function speichernForm() {
    if (!form) return;
    if (!form.id && !form.benutzername.trim() && !form.anzeigename.trim()) {
      setFehler("Bitte eine Bezeichnung oder einen Login angeben.");
      return;
    }
    if (form.passwort && form.passwort.length < 4) {
      setFehler("Das Passwort muss mindestens 4 Zeichen haben.");
      return;
    }
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
      setFehler("Die PIN muss aus 4–6 Ziffern bestehen.");
      return;
    }
    // Neue Person braucht mindestens eine Anmeldeart (Passwort ODER PIN).
    if (!form.id && !form.passwort && !form.pin) {
      setFehler("Bitte ein Passwort oder eine PIN vergeben.");
      return;
    }
    setSpeichern(true);
    setFehler(null);
    const body: Record<string, unknown> = {
      anzeigename: form.anzeigename.trim() || null,
      rolle: form.rolle,
      darfZahlen: form.darfZahlen,
      darfStornieren: form.darfStornieren,
      aktiv: form.aktiv,
      arbeitsbereichIds: form.arbeitsbereichIds,
    };
    if (form.benutzername.trim()) body.benutzername = form.benutzername.trim();
    if (form.passwort) body.passwort = form.passwort;
    // PIN: entfernen (leer) hat Vorrang; sonst nur bei Eingabe setzen.
    if (form.pinEntfernen) body.pin = "";
    else if (form.pin) body.pin = form.pin;
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

  function neuDrucker() {
    setDruckerForm({ name: "", typ: "SYSTEM", ip: "", aktiv: true, arbeitsbereichId: "" });
  }
  function bearbeitenDrucker(d: Drucker) {
    setDruckerForm({ id: d.id, name: d.name, typ: d.typ, ip: d.ip ?? "", aktiv: d.aktiv, arbeitsbereichId: d.arbeitsbereichId ?? "" });
  }
  async function speichernDrucker() {
    if (!druckerForm) return;
    if (!druckerForm.name.trim()) {
      setFehler("Name des Druckers ist erforderlich.");
      return;
    }
    setSpeichern(true);
    setFehler(null);
    const body = {
      name: druckerForm.name.trim(),
      typ: druckerForm.typ,
      ip: druckerForm.ip.trim() || null,
      aktiv: druckerForm.aktiv,
      arbeitsbereichId: druckerForm.arbeitsbereichId || null,
    };
    try {
      if (druckerForm.id) {
        await jsonFetch(`/api/admin/drucker/${druckerForm.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await jsonFetch("/api/admin/drucker", { method: "POST", body: JSON.stringify(body) });
      }
      setDruckerForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setSpeichern(false);
    }
  }
  async function loeschenDrucker() {
    if (!druckerForm?.id) return;
    const ok = await dialog.confirm({ titel: "Drucker löschen", text: `Drucker „${druckerForm.name}" löschen?`, bestaetigenText: "Löschen", gefahr: true });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/drucker/${druckerForm.id}`, { method: "DELETE" });
      setDruckerForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  // Erzeugt eine neue 6-stellige PIN für eine Person (eindeutig; bei Kollision erneut).
  async function pinErzeugen(id: string) {
    setFehler(null);
    for (let versuch = 0; versuch < 6; versuch++) {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      try {
        await jsonFetch(`/api/admin/benutzer/${id}`, { method: "PATCH", body: JSON.stringify({ pin }) });
        setPins((p) => ({ ...p, [id]: pin }));
        laden();
        return;
      } catch (e) {
        const m = (e as Error).message;
        if (!/vergeben/i.test(m)) {
          setFehler(m);
          return;
        }
        // PIN bereits vergeben -> nächster Versuch
      }
    }
    setFehler("Konnte keine freie PIN erzeugen. Bitte erneut versuchen.");
  }

  async function alleFehlendenPins() {
    // Für alle aktiven Nicht-Admins ohne PIN eine erzeugen.
    for (const b of benutzer) {
      if (b.aktiv && b.rolle !== "ADMIN" && !b.hatPin && !pins[b.id]) {
        // eslint-disable-next-line no-await-in-loop
        await pinErzeugen(b.id);
      }
    }
  }

  async function pdfZugaenge() {
    setFehler(null);
    // Neues Tab SOFORT (im Klick) öffnen, sonst blockiert der Popup-Schutz nach dem await.
    const tab = window.open("", "_blank");
    try {
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const seiteB = 210, mx = 16;
      const url = `${window.location.origin}/admin/login`;

      // Kopf
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(konfig.titel || "Zugänge", mx, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const sub = [konfig.veranstaltung, `Stand: ${new Date().toLocaleDateString("de-AT")}`].filter(Boolean).join("  ·  ");
      doc.text(sub, mx, 26);
      doc.text(`Anmeldung am Tablet: ${url}`, mx, 31);
      // QR oben rechts
      try {
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 200 });
        doc.addImage(qr, "PNG", seiteB - mx - 26, 12, 26, 26);
      } catch {
        /* QR optional */
      }

      // Tabellenkopf
      let y = 44;
      const cx = [mx, mx + 58, mx + 100, mx + 150];
      doc.setFont("helvetica", "bold");
      doc.text("Bezeichnung", cx[0], y);
      doc.text("Funktion", cx[1], y);
      doc.text("Login", cx[2], y);
      doc.text("PIN", cx[3], y);
      y += 2;
      doc.setDrawColor(170);
      doc.line(mx, y, seiteB - mx, y);
      y += 5;
      doc.setFont("helvetica", "normal");

      for (const b of benutzer.filter((x) => x.aktiv)) {
        if (y > 285) {
          doc.addPage();
          y = 20;
        }
        const pin = pins[b.id] ? pins[b.id] : b.hatPin ? "(gesetzt)" : "—";
        doc.text((b.anzeigename || b.benutzername).slice(0, 28), cx[0], y);
        doc.text((ROLLEN_LABEL[b.rolle as Rolle] ?? b.rolle).slice(0, 20), cx[1], y);
        doc.text("@" + b.benutzername, cx[2], y);
        doc.setFont("courier", pins[b.id] ? "bold" : "normal");
        doc.setFontSize(pins[b.id] ? 12 : 10);
        doc.text(pin, cx[3], y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        y += 7;
      }
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('„(gesetzt)" = PIN vorhanden, aber aus Sicherheitsgründen nicht anzeigbar – bei Bedarf neu erzeugen.', mx, 292);

      const blobUrl = doc.output("bloburl") as unknown as string;
      if (tab) tab.location.href = blobUrl;
      else window.open(blobUrl, "_blank");
    } catch (e) {
      tab?.close();
      setFehler("PDF konnte nicht erzeugt werden: " + (e as Error).message);
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
        <button className="btn-ghost" onClick={() => setZugaengeOffen(true)}>
          🔑 Zugänge
        </button>
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
        <PlanAnsicht
          benutzer={benutzer}
          bereiche={bereiche}
          drucker={drucker}
          onPerson={bearbeiten}
          onNeuPerson={neu}
          onDrucker={bearbeitenDrucker}
          onNeuDrucker={neuDrucker}
        />
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
          fehler={fehler}
          onSpeichern={speichernForm}
          onLoeschen={form.id ? loeschen : undefined}
          onAbbrechen={() => {
            setForm(null);
            setFehler(null);
          }}
        />
      )}

      {druckerForm && (
        <DruckerEditor
          form={druckerForm}
          setForm={setDruckerForm}
          bereiche={bereiche}
          speichern={speichern}
          fehler={fehler}
          onSpeichern={speichernDrucker}
          onLoeschen={druckerForm.id ? loeschenDrucker : undefined}
          onAbbrechen={() => {
            setDruckerForm(null);
            setFehler(null);
          }}
        />
      )}

      {zugaengeOffen && (
        <ZugaengeListe
          benutzer={benutzer}
          pins={pins}
          fehler={fehler}
          onPin={pinErzeugen}
          onAllePins={alleFehlendenPins}
          onDrucken={pdfZugaenge}
          onSchliessen={() => {
            setZugaengeOffen(false);
            setFehler(null);
          }}
        />
      )}
    </div>
  );
}

function ZugaengeListe({
  benutzer,
  pins,
  fehler,
  onPin,
  onAllePins,
  onDrucken,
  onSchliessen,
}: {
  benutzer: Benutzer[];
  pins: Record<string, string>;
  fehler: string | null;
  onPin: (id: string) => void;
  onAllePins: () => void;
  onDrucken: () => void;
  onSchliessen: () => void;
}) {
  const liste = benutzer.filter((b) => b.aktiv);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-2xl max-h-[92dvh] flex flex-col p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">🔑 Zugänge / Anmeldung</h2>
          <span className="ml-auto text-xs text-neutral-500">{liste.length} aktive Personen</span>
        </div>
        <p className="text-sm text-neutral-400 mb-3">
          Personal meldet sich am Tablet per <b>PIN</b> an. Bereits gesetzte PINs sind aus Sicherheitsgründen nicht
          mehr lesbar – bei Bedarf neu erzeugen (dann hier einmalig sichtbar) und ausdrucken.
        </p>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400 border-b border-neutral-800">
                <th className="py-1.5 pr-2">Bezeichnung</th>
                <th className="py-1.5 pr-2">Funktion</th>
                <th className="py-1.5 pr-2">Login</th>
                <th className="py-1.5 pr-2">PIN</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((b) => (
                <tr key={b.id} className="border-b border-neutral-900">
                  <td className="py-1.5 pr-2">{b.anzeigename || b.benutzername}</td>
                  <td className="py-1.5 pr-2 text-neutral-400">{ROLLEN_LABEL[b.rolle as Rolle] ?? b.rolle}</td>
                  <td className="py-1.5 pr-2 font-mono">@{b.benutzername}</td>
                  <td className="py-1.5 pr-2 font-mono tabular-nums">
                    {pins[b.id] ? (
                      <span className="text-brand-50 font-bold text-base">{pins[b.id]}</span>
                    ) : b.hatPin ? (
                      <span className="text-neutral-500">••••••</span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <button className="btn-ghost py-1 text-xs" onClick={() => onPin(b.id)}>
                      {b.hatPin || pins[b.id] ? "PIN neu" : "PIN erzeugen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fehler && <p className="text-red-300 text-sm mt-2">{fehler}</p>}

        <div className="flex gap-2 pt-3 flex-wrap">
          <button className="btn-ghost" onClick={onAllePins}>
            PINs für alle ohne PIN erzeugen
          </button>
          <button className="btn-ghost" onClick={onDrucken}>
            📄 PDF öffnen
          </button>
          <button className="btn-primary ml-auto" onClick={onSchliessen}>
            Schließen
          </button>
        </div>
      </div>
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

const AREA_FARBEN = ["#378ADD", "#7F77DD", "#D85A30", "#1D9E75", "#EF9F27", "#D4537E", "#5DCAA5", "#BA7517"];
function initialen(s: string): string {
  return (s || "?").slice(0, 2).toUpperCase();
}

/**
 * Dynamische Bogen-/Halbkreis-Ansicht: alle Rollen, Bereiche und Drucker als
 * Plätze auf einem Halbkreis. Passt sich automatisch an jede Anzahl an
 * (2 oder 15 Kellner, 1 oder 15 Drucker …).
 */
function PlanAnsicht({
  benutzer,
  bereiche,
  drucker,
  onPerson,
  onNeuPerson,
  onDrucker,
  onNeuDrucker,
}: {
  benutzer: Benutzer[];
  bereiche: Bereich[];
  drucker: Drucker[];
  onPerson: (b: Benutzer) => void;
  onNeuPerson: (prefill?: Partial<FormState>) => void;
  onDrucker: (d: Drucker) => void;
  onNeuDrucker: () => void;
}) {
  const layout = useMemo(() => {
    type Sitz = { key: string; label: string; title: string; farbe: string; aktiv: boolean; add?: boolean; onClick: () => void };
    type Gruppe = { key: string; label: string; farbe: string; sitze: Sitz[]; onAdd?: () => void };
    const person = (b: Benutzer, farbe: string): Sitz => ({
      key: b.id,
      label: initialen(b.anzeigename || b.benutzername),
      title: `${b.anzeigename || b.benutzername} (@${b.benutzername})`,
      farbe,
      aktiv: b.aktiv,
      onClick: () => onPerson(b),
    });
    const gruppen: Gruppe[] = [];
    gruppen.push({
      key: "verkauf", label: "Verkauf", farbe: "#639922",
      sitze: benutzer.filter((b) => b.rolle === "KELLNER").map((b) => person(b, "#639922")),
    });
    bereiche.forEach((ab, i) => {
      const farbe = AREA_FARBEN[i % AREA_FARBEN.length];
      gruppen.push({
        key: "ab_" + ab.id, label: ab.name, farbe,
        sitze: benutzer.filter((b) => b.rolle === "BEREICH" && b.arbeitsbereichIds.includes(ab.id)).map((b) => person(b, farbe)),
      });
    });
    gruppen.push({
      key: "kassa", label: "Kassa", farbe: "#BA7517",
      sitze: benutzer.filter((b) => b.rolle === "KASSA").map((b) => person(b, "#BA7517")),
    });
    gruppen.push({
      key: "drucker", label: "Drucker", farbe: "#6b7280",
      sitze: drucker.map((d) => ({
        key: d.id, label: initialen(d.name), title: d.name + (d.ip ? ` (${d.ip})` : ""), farbe: "#6b7280", aktiv: d.aktiv, onClick: () => onDrucker(d),
      })),
    });
    gruppen.push({
      key: "leitung", label: "Leitung", farbe: "#888780",
      sitze: benutzer.filter((b) => b.rolle === "ADMIN" || b.rolle === "SUPERVISOR").map((b) => person(b, "#888780")),
    });

    // Je Gruppe einen „+"-Platz zum Hinzufügen anhängen.
    for (const g of gruppen) {
      const add = g.key === "verkauf"
        ? () => onNeuPerson({ rolle: "KELLNER" })
        : g.key === "kassa"
          ? () => onNeuPerson({ rolle: "KASSA", darfZahlen: true })
          : g.key === "leitung"
            ? () => onNeuPerson({ rolle: "ADMIN" })
            : g.key === "drucker"
              ? onNeuDrucker
              : () => onNeuPerson({ rolle: "BEREICH", arbeitsbereichIds: [g.key.slice(3)] });
      g.onAdd = add;
      g.sitze.push({ key: g.key + "_add", label: "+", title: `${g.label}: hinzufügen`, farbe: g.farbe, aktiv: true, add: true, onClick: add });
    }

    // Flache Sitzliste in Gruppen-Reihenfolge + Startindex je Gruppe.
    const flach: Sitz[] = [];
    const grenzen: number[] = [];
    for (const g of gruppen) {
      grenzen.push(flach.length);
      for (const s of g.sitze) flach.push(s);
    }
    const total = flach.length || 1;
    const rad = (deg: number) => (deg * Math.PI) / 180;

    // Ein Ring, solange alles bequem draufpasst; darüber automatisch konzentrische
    // Ringe (wie Sitzreihen), damit es auch bei vielen Plätzen kompakt bleibt.
    const pitch = 34, ringGap = 40, Rmax = 300, Rmin = 150;
    const capAt = (r: number) => Math.max(4, Math.floor((Math.PI * r) / pitch));
    const einRingR = Math.round((pitch * total) / Math.PI);
    let ringe: { r: number; count: number }[];
    if (einRingR <= Rmax) {
      ringe = [{ r: Math.max(Rmin, Math.min(Rmax, einRingR || Rmin)), count: total }];
    } else {
      const caps: { r: number; cap: number }[] = [];
      for (let n = 1; n <= 6; n++) {
        const r = Math.max(Rmin, Rmax - (n - 1) * ringGap);
        caps.push({ r, cap: capAt(r) });
        if (caps.reduce((s, c) => s + c.cap, 0) >= total || r <= Rmin) break;
      }
      const sumCap = caps.reduce((s, c) => s + c.cap, 0) || 1;
      let rest = total;
      ringe = caps.map((c, i) => {
        const cnt = i === caps.length - 1 ? rest : Math.min(rest, Math.round((total * c.cap) / sumCap));
        rest -= cnt;
        return { r: c.r, count: cnt };
      });
    }
    const mehrring = ringe.length > 1;
    const outerR = ringe[0].r;
    const cx = outerR + 170, cy = outerR + 74;

    let idx = 0;
    const sitze: { x: number; y: number; s: Sitz }[] = [];
    for (const ring of ringe) {
      const slot = 180 / Math.max(ring.count, 1);
      for (let j = 0; j < ring.count; j++) {
        const s = flach[idx++];
        if (!s) break;
        const th = rad(180 - (j + 0.5) * slot);
        sitze.push({ x: cx + ring.r * Math.cos(th), y: cy - ring.r * Math.sin(th), s });
      }
    }

    // Sektions-Label an der Mittelachse jeder Gruppe, außerhalb des Bogens.
    // Seitenabhängige Ausrichtung + leichte Versetzung, damit sich nichts überlappt.
    const labels: { x: number; y: number; text: string; anchor: "start" | "middle" | "end" }[] = [];
    gruppen.forEach((g, gi) => {
      const pts = sitze.slice(grenzen[gi], grenzen[gi] + g.sitze.length);
      if (!pts.length) return;
      const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      let dx = ax - cx, dy = ay - cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const lr = outerR + 20 + (gi % 3) * 22;
      const anchor: "start" | "middle" | "end" = dx < -0.25 ? "end" : dx > 0.25 ? "start" : "middle";
      const text = g.label.length > 13 ? g.label.slice(0, 12) + "…" : g.label;
      labels.push({ x: cx + dx * lr, y: cy + dy * lr, text, anchor });
    });
    // Trennlinien nur im Ein-Ring-Modus (bei mehreren Ringen genügen Farbe + Legende).
    const trenner: { x1: number; y1: number; x2: number; y2: number }[] = [];
    if (!mehrring) {
      let k = 0;
      const slot = 180 / total;
      for (const g of gruppen) {
        const thB = rad(180 - k * slot);
        trenner.push({ x1: cx + 62 * Math.cos(thB), y1: cy - 62 * Math.sin(thB), x2: cx + (outerR + 16) * Math.cos(thB), y2: cy - (outerR + 16) * Math.sin(thB) });
        k += g.sitze.length;
      }
    }
    return { gruppen, sitze, trenner, labels, cx, cy, vbW: 2 * outerR + 340, vbH: outerR + 118 };
  }, [benutzer, bereiche, drucker, onPerson, onNeuPerson, onDrucker, onNeuDrucker]);

  const { sitze, trenner, labels, cx, cy, vbW, vbH, gruppen } = layout;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto" style={{ minWidth: 320 }} role="img" aria-label="Aufbau als Halbkreis">
          {trenner.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#3f3f46" strokeWidth={1} strokeDasharray="2 5" />
          ))}
          {labels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline="middle" fontSize={12} fill="#cbd5e1">{l.text}</text>
          ))}
          {sitze.map(({ x, y, s }) =>
            s.add ? (
              <g key={s.key} style={{ cursor: "pointer" }} onClick={s.onClick}>
                <title>{s.title}</title>
                <circle cx={x} cy={y} r={13} fill="transparent" stroke={s.farbe} strokeWidth={1.6} strokeDasharray="3 3" />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={16} fill={s.farbe}>+</text>
              </g>
            ) : (
              <g key={s.key} style={{ cursor: "pointer", opacity: s.aktiv ? 1 : 0.4 }} onClick={s.onClick}>
                <title>{s.title}</title>
                <circle cx={x} cy={y} r={14} fill={s.farbe} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#ffffff">{s.label}</text>
              </g>
            ),
          )}
          <g>
            <rect x={cx - 62} y={cy - 15} width={124} height={30} rx={8} fill="#1f1f23" stroke="#52525b" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#a3a3a3">Ausgabe · Gast</text>
          </g>
        </svg>
      </div>

      {/* Hinzufügen je Bereich – benannt und eindeutig (klarer als das „+" am Bogen). */}
      <div>
        <div className="text-xs text-neutral-500 mb-1.5">Hinzufügen – Bereich antippen:</div>
        <div className="flex flex-wrap gap-2 text-sm">
          {gruppen.map((g) => (
            <button
              key={g.key}
              onClick={g.onAdd}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 px-3 py-1.5 hover:border-brand-600 hover:text-white transition"
              title={`${g.label}: hinzufügen`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: g.farbe }} />
              {g.label} <span className="text-neutral-500">({g.sitze.length - 1})</span>
              <span className="text-brand-50 font-semibold text-base leading-none">＋</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-neutral-500">Tipp: Platz am Bogen antippen zum Bearbeiten. Zum Hinzufügen unten den Bereich wählen (oder das farbige „+" am Bogen).</p>
    </div>
  );
}

function DruckerEditor({
  form,
  setForm,
  bereiche,
  speichern,
  fehler,
  onSpeichern,
  onLoeschen,
  onAbbrechen,
}: {
  form: DruckerForm;
  setForm: (f: DruckerForm) => void;
  bereiche: Bereich[];
  speichern: boolean;
  fehler: string | null;
  onSpeichern: () => void;
  onLoeschen?: () => void;
  onAbbrechen: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md p-5 space-y-3">
        <h2 className="text-lg font-semibold">{form.id ? "Drucker bearbeiten" : "Neuer Drucker"}</h2>
        <label className="block">
          <span className="text-sm text-neutral-400">Name</span>
          <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z. B. Bon Bierzelt" />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Typ</span>
          <select className="input mt-1" value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value as "SYSTEM" | "NETZWERK" })}>
            <option value="SYSTEM">Systemdrucker (Tablet/Browser)</option>
            <option value="NETZWERK">Netzwerk (ESC/POS über IP)</option>
          </select>
        </label>
        {form.typ === "NETZWERK" && (
          <label className="block">
            <span className="text-sm text-neutral-400">IP-Adresse</span>
            <input className="input mt-1" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="z. B. 192.168.0.50" inputMode="decimal" />
          </label>
        )}
        <label className="block">
          <span className="text-sm text-neutral-400">Arbeitsbereich (optional)</span>
          <select className="input mt-1" value={form.arbeitsbereichId} onChange={(e) => setForm({ ...form, arbeitsbereichId: e.target.value })}>
            <option value="">— keiner —</option>
            {bereiche.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-brand-600 h-4 w-4" checked={form.aktiv} onChange={(e) => setForm({ ...form, aktiv: e.target.checked })} />
          <span className="text-sm">aktiv</span>
        </label>
        {fehler && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
            {fehler}
          </p>
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
  fehler,
  onSpeichern,
  onLoeschen,
  onAbbrechen,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  bereiche: Bereich[];
  speichern: boolean;
  fehler: string | null;
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
          <span className="text-sm text-neutral-400">Login (Benutzername) – optional, wird sonst automatisch erzeugt</span>
          <input
            className="input mt-1"
            value={form.benutzername}
            onChange={(e) => setForm({ ...form, benutzername: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="leer lassen für PIN-Anmeldung"
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

        {/* PIN für den Schnell-Login am Tablet */}
        <label className="block">
          <span className="text-sm text-neutral-400">
            PIN (6 Ziffern, für Schnell-Login){form.pinGesetzt ? " – gesetzt" : ""}
          </span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="input tracking-widest flex-1"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6), pinEntfernen: false })}
              placeholder={form.pinGesetzt ? "•••••• (leer = unverändert)" : "z. B. 246810"}
              autoComplete="off"
              disabled={form.pinEntfernen}
            />
            <button
              type="button"
              className="btn-ghost shrink-0"
              disabled={form.pinEntfernen}
              onClick={() => setForm({ ...form, pin: String(Math.floor(100000 + Math.random() * 900000)), pinEntfernen: false })}
              title="Zufällige PIN erzeugen"
            >
              🎲 Generieren
            </button>
          </div>
          {form.pinGesetzt && (
            <label className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                className="accent-brand-600 h-3.5 w-3.5"
                checked={form.pinEntfernen}
                onChange={(e) => setForm({ ...form, pinEntfernen: e.target.checked, pin: "" })}
              />
              PIN entfernen
            </label>
          )}
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

        {fehler && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
            {fehler}
          </p>
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
