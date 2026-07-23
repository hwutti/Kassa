/* Demo-Seed für Schulung/Screenshots: reichhaltiger, NEUTRALER Datensatz mit
 * Preisen, echten Produktbildern, mehreren Rollen, abgeschlossenen Bestellungen
 * (Auswertungen) und laufenden Bestellungen (Küche/KDS + Meine/Ausgeben).
 * Aufruf:  npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPasswort } from "../src/lib/passwort";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const SRC_IMG = "C:/Users/HERBER~1/AppData/Local/Temp/claude/C--Claude-code-IKTMT-MTGX/5fd8c004-c771-4c4b-a2e6-0ea4e052aa4d/scratchpad/bilder";
const UPLOADS = path.join(process.cwd(), "public", "uploads");

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Kopiert ein Quellbild nach public/uploads und liefert die bildUrl (oder null). */
function bild(rel: string | null, name: string): string | null {
  if (!rel) return null;
  const src = path.join(SRC_IMG, rel);
  if (!existsSync(src)) { console.warn("  ! Bild fehlt:", rel); return null; }
  const ziel = slug(name) + ".jpg";
  copyFileSync(src, path.join(UPLOADS, ziel));
  return "/uploads/" + ziel;
}

// [name, icon, preisCent, bildRelativ|null, ausverkauft?]
type PDef = [string, string, number, string | null, boolean?];

const PRODUKTE: Record<string, PDef[]> = {
  bier: [
    ["Bier klein", "🍺", 350, "Getraenke/Bier klein.jpg"],
    ["Bier groß", "🍺", 450, "Getraenke/Bier groß.jpg"],
    ["Radler klein", "🍻", 350, "Getraenke/Radler klein.jpg"],
    ["Radler groß", "🍻", 450, "Getraenke/Radler groß.jpg"],
    ["Alkoholfreies Bier", "🍺", 400, "Getraenke/Alkoholfreies Bier.jpg"],
  ],
  wein: [
    ["Weißwein 1/8 Liter", "🍷", 250, "Getraenke/Weißwein 1_8 Liter.jpg"],
    ["Weißwein 1/4 Liter", "🍷", 450, "Getraenke/Weißwein 1_4 Liter.jpg"],
    ["Rotwein 1/8 Liter", "🍷", 250, "Getraenke/Rotwein 1_8 Liter.jpg"],
    ["Rotwein 1/4 Liter", "🍷", 450, "Getraenke/Rotwein 1_4 Liter.jpg"],
    ["Weißer Spritzer klein", "🥂", 300, "Getraenke/Weißer Spritzer klein.jpg"],
    ["Weißer Spritzer groß", "🥂", 400, "Getraenke/Weißer Spritzer groß.jpg"],
    ["Roter Spritzer klein", "🥂", 300, "Getraenke/Roter Spritzer klein.jpg"],
    ["Roter Spritzer groß", "🥂", 400, "Getraenke/Roter Spritzer groß.jpg"],
    ["Sommerspritzer", "🥂", 400, "Getraenke/Sommerspritzer.jpg"],
  ],
  afrei: [
    ["Limonade klein", "🥤", 250, "Getraenke/Limonade.jpg"],
    ["Limonade groß", "🥤", 350, "Getraenke/Limonade groß.jpg"],
    ["Cola klein", "🥤", 250, "Getraenke/Cola klein.jpg"],
    ["Cola groß", "🥤", 350, "Getraenke/Cola Fanta.jpg"],
    ["Mineralwasser", "💧", 250, "Getraenke/Mineralwasser.jpg"],
    ["Apfelsaft", "🧃", 300, "Getraenke/Apfelsaft.jpg"],
    ["Apfelsaft gespritzt", "🧃", 300, "Getraenke/Apfelsaft gespritzt.jpg"],
    ["Orangensaft", "🍊", 300, "Getraenke/Orangensaft.jpg"],
    ["Kindergetränk", "🧒", 200, "Getraenke/Kindergetränk.jpg"],
  ],
  essen: [
    ["Bratwürstel", "🌭", 400, "Essen/Bratwurst mit Semmel.jpg"],
    ["Bratwürstel mit Brot", "🌭", 450, "Essen/Bratwürstel mit Brot.jpg"],
    ["Kotelett", "🍖", 700, "Essen/Kotelett mit Semmel.jpg"],
    ["Kotelett mit Beilage", "🍖", 850, "Essen/Kotelett mit Beilage.jpg"],
    ["Grillteller", "🍽️", 1100, "Essen/Grillteller.jpg", true], // ausverkauft
    ["Pommes", "🍟", 350, "Essen/Pommes.jpg"],
    ["Frankfurter", "🌭", 400, "Essen/Frankfurter.jpg"],
    ["Brot", "🍞", 100, "Essen/Brot.jpg"],
    ["Portion Senf", "🥫", 50, "Essen/Portion Senf.jpg"],
  ],
  kaffee: [
    ["Kaffee", "☕", 280, "Kaffee_und_Kuchen/Kaffee.jpg"],
    ["Verlängerter", "☕", 300, "Kaffee_und_Kuchen/Verlängerter.jpg"],
    ["Espresso", "☕", 260, "Kaffee_und_Kuchen/Espresso.jpg"],
    ["Cappuccino", "☕", 320, "Kaffee_und_Kuchen/Cappuccino.jpg"],
    ["Tee", "🍵", 260, "Kaffee_und_Kuchen/Tee.jpg"],
    ["Kuchen", "🍰", 300, "Kaffee_und_Kuchen/Kuchen.jpg"],
    ["Torte", "🎂", 350, "Kaffee_und_Kuchen/Torte.jpg"],
    ["Kaffee und Kuchen", "☕", 550, "Kaffee_und_Kuchen/Kuchen.jpg"],
  ],
  schnaps: [
    ["Obstler", "🥃", 300, "Schnaepse_und_Likoere/Obstler.jpg"],
    ["Marillenschnaps", "🥃", 350, "Schnaepse_und_Likoere/Marillenschnaps.jpg"],
    ["Baccardi Cola", "🥤", 450, "Schnaepse_und_Likoere/Baccardi Cola.jpg"],
    ["Gurktaler", "🥃", 350, "Schnaepse_und_Likoere/Gurktaler.jpg"],
    ["Feigling", "🍶", 300, "Schnaepse_und_Likoere/Klopfer Feigling.jpg"],
    ["Gummibärli", "🍬", 300, "Schnaepse_und_Likoere/Gummibärli.jpg"],
    ["Williams", "🥃", 350, null],
    ["Kräuterschnaps", "🥃", 300, null],
    ["Likör", "🍸", 300, null],
  ],
};

type PInfo = { id: string; name: string; preisCent: number; katName: string; vbName: string; abName: string; abId: string };
const alleProdukte: PInfo[] = [];

async function main() {
  if (!existsSync(UPLOADS)) mkdirSync(UPLOADS, { recursive: true });

  console.log("Demo-Seed: räume bestehende Daten auf …");
  await prisma.bestellPosition.deleteMany();
  await prisma.bereichsticket.deleteMany();
  await prisma.zahlung.deleteMany();
  await prisma.bestellung.deleteMany();
  await prisma.auditEreignis.deleteMany();
  await prisma.preishistorie.deleteMany();
  await prisma.produktVerkaufsbereich.deleteMany();
  await prisma.produktArbeitsbereich.deleteMany();
  await prisma.benutzerArbeitsbereich.deleteMany();
  await prisma.benutzer.deleteMany();
  await prisma.drucker.deleteMany();
  await prisma.produkt.deleteMany();
  await prisma.kategorie.deleteMany();
  await prisma.verkaufsbereich.deleteMany();
  await prisma.arbeitsbereich.deleteMany();
  await prisma.veranstaltung.deleteMany();
  await prisma.zaehler.deleteMany();

  await prisma.einstellung.upsert({
    where: { id: "app" },
    update: { titel: "Sommerfest", untertitel: "Vereinskasse", design: "dunkel", bedienungsmodus: "SZENARIO_1" },
    create: { id: "app", titel: "Sommerfest", untertitel: "Vereinskasse", design: "dunkel", bedienungsmodus: "SZENARIO_1" },
  });

  await prisma.veranstaltung.create({
    data: {
      name: "Sommerfest 2026", beschreibung: "Aktuelles Fest", aktiv: true,
      von: new Date("2026-07-24T10:00:00"), bis: new Date("2026-07-26T23:00:00"),
    },
  });
  const veranstaltung = await prisma.veranstaltung.findFirst({ where: { aktiv: true } });
  await prisma.veranstaltung.create({ data: { name: "Frühlingsfest 2026", beschreibung: "abgeschlossen", aktiv: false } });

  await prisma.benutzer.upsert({
    where: { benutzername: "admin" },
    update: {},
    create: { benutzername: "admin", passwortHash: hashPasswort("kirchtag"), rolle: "ADMIN" },
  });

  const vb = {
    getraenke: await prisma.verkaufsbereich.create({ data: { name: "Getränkeausschank", icon: "🍹", beschreibung: "Alle Getränke", sortierung: 1 } }),
    bier: await prisma.verkaufsbereich.create({ data: { name: "Bier und Radler", icon: "🍺", sortierung: 2 } }),
    wein: await prisma.verkaufsbereich.create({ data: { name: "Wein und Spritzer", icon: "🍷", sortierung: 3 } }),
    kueche: await prisma.verkaufsbereich.create({ data: { name: "Küche und Grill", icon: "🔥", sortierung: 4 } }),
    kaffee: await prisma.verkaufsbereich.create({ data: { name: "Kaffee und Kuchen", icon: "☕", sortierung: 5 } }),
    schnaps: await prisma.verkaufsbereich.create({ data: { name: "Schnaps und Spirituosen", icon: "🥃", sortierung: 6 } }),
    allgemein: await prisma.verkaufsbereich.create({ data: { name: "Allgemeine Kassa", icon: "🧾", beschreibung: "Zeigt alle gültigen, aktiven Produkte", istAllgemein: true, sortierung: 7 } }),
  };

  const kat = {
    bier: await prisma.kategorie.create({ data: { name: "Bier und Radler", icon: "🍺", farbe: "#f59e0b", sortierung: 1 } }),
    wein: await prisma.kategorie.create({ data: { name: "Wein und Spritzer", icon: "🍷", farbe: "#b91c1c", sortierung: 2 } }),
    afrei: await prisma.kategorie.create({ data: { name: "Alkoholfreie Getränke", icon: "🥤", farbe: "#2563eb", sortierung: 3 } }),
    essen: await prisma.kategorie.create({ data: { name: "Essen", icon: "🍽️", farbe: "#16a34a", sortierung: 4 } }),
    kaffee: await prisma.kategorie.create({ data: { name: "Kaffee und Kuchen", icon: "☕", farbe: "#92400e", sortierung: 5 } }),
    schnaps: await prisma.kategorie.create({ data: { name: "Schnaps und Spirituosen", icon: "🥃", farbe: "#7c3aed", sortierung: 6 } }),
  };

  const ab = {
    bier: await prisma.arbeitsbereich.create({ data: { name: "Bierausgabe", icon: "🍺", sortierung: 1 } }),
    wein: await prisma.arbeitsbereich.create({ data: { name: "Weinausgabe", icon: "🍷", sortierung: 2 } }),
    getraenke: await prisma.arbeitsbereich.create({ data: { name: "Getränke (alkoholfrei)", icon: "🥤", sortierung: 3 } }),
    kueche: await prisma.arbeitsbereich.create({ data: { name: "Küche", icon: "🍳", sortierung: 4 } }),
    kaffee: await prisma.arbeitsbereich.create({ data: { name: "Kaffee und Kuchen", icon: "☕", sortierung: 5 } }),
    schnaps: await prisma.arbeitsbereich.create({ data: { name: "Schnapsausgabe", icon: "🥃", sortierung: 6 } }),
  };

  await prisma.drucker.create({ data: { name: "Bondrucker Kassa", typ: "SYSTEM", sortierung: 1, arbeitsbereichId: null } });
  await prisma.drucker.create({ data: { name: "Küchendrucker", typ: "NETZWERK", ip: "192.168.1.50", sortierung: 2, arbeitsbereichId: ab.kueche.id } });
  await prisma.drucker.create({ data: { name: "Bierausgabe-Drucker", typ: "NETZWERK", ip: "192.168.1.51", sortierung: 3, arbeitsbereichId: ab.bier.id } });

  const katMeta: Record<string, { kat: any; ab: any; vb: any[] }> = {
    bier: { kat: kat.bier, ab: ab.bier, vb: [vb.bier, vb.getraenke] },
    wein: { kat: kat.wein, ab: ab.wein, vb: [vb.wein, vb.getraenke] },
    afrei: { kat: kat.afrei, ab: ab.getraenke, vb: [vb.getraenke] },
    essen: { kat: kat.essen, ab: ab.kueche, vb: [vb.kueche] },
    kaffee: { kat: kat.kaffee, ab: ab.kaffee, vb: [vb.kaffee] },
    schnaps: { kat: kat.schnaps, ab: ab.schnaps, vb: [vb.schnaps] },
  };

  let sort = 0;
  let mitBild = 0;
  for (const key of Object.keys(PRODUKTE)) {
    const meta = katMeta[key];
    for (const [name, icon, preisCent, rel, ausverkauft] of PRODUKTE[key]) {
      const bildUrl = bild(rel, name);
      if (bildUrl) mitBild++;
      const prod = await prisma.produkt.create({
        data: {
          name, icon, preisCent, bildUrl: bildUrl ?? undefined,
          ausverkauft: ausverkauft ?? false, sortierung: ++sort,
          kategorieId: meta.kat.id, preisGeaendertAm: new Date(),
        },
      });
      for (const b of meta.vb) {
        await prisma.produktVerkaufsbereich.create({ data: { produktId: prod.id, verkaufsbereichId: b.id } });
      }
      await prisma.produktArbeitsbereich.create({ data: { produktId: prod.id, arbeitsbereichId: meta.ab.id, primaer: true } });
      alleProdukte.push({
        id: prod.id, name, preisCent, katName: meta.kat.name,
        vbName: vb.allgemein.name, abName: meta.ab.name, abId: meta.ab.id,
      });
    }
  }

  const pinHash = hashPasswort("123456");
  async function u(benutzername: string, anzeigename: string, rolle: string, extra: Record<string, unknown> = {}, pin = false) {
    return prisma.benutzer.create({
      data: { benutzername, anzeigename, passwortHash: hashPasswort("kirchtag"), rolle, pinHash: pin ? pinHash : null, ...extra },
    });
  }
  const max = await u("max", "Kellner Max", "KELLNER", { darfZahlen: true }, true);
  const eva = await u("eva", "Kellnerin Eva", "KELLNER", {}, true);
  const lukas = await u("lukas", "Kellner Lukas", "KELLNER", {}, true);
  await u("kasse", "Zentralkasse", "KASSA", { darfZahlen: true, darfStornieren: true }, true);
  const kuecheU = await u("kueche", "Küche", "BEREICH", {});
  const grillU = await u("grill", "Grillstation", "BEREICH", {});
  const bierU = await u("bier", "Bierausgabe", "BEREICH", { darfZahlen: true });
  const weinU = await u("wein", "Weinausgabe", "BEREICH", {});
  const kaffeeU = await u("kaffee", "Kaffee & Kuchen", "BEREICH", {});
  await u("chef", "Festleitung", "SUPERVISOR", {});
  await prisma.benutzerArbeitsbereich.createMany({
    data: [
      { benutzerId: kuecheU.id, arbeitsbereichId: ab.kueche.id },
      { benutzerId: grillU.id, arbeitsbereichId: ab.kueche.id },
      { benutzerId: bierU.id, arbeitsbereichId: ab.bier.id },
      { benutzerId: weinU.id, arbeitsbereichId: ab.wein.id },
      { benutzerId: kaffeeU.id, arbeitsbereichId: ab.kaffee.id },
    ],
  });

  const kellnerPool = [max.id, eva.id, lukas.id, null];
  const zahlarten = ["BAR", "BAR", "BAR", "BAR", "KARTE", "KARTE", "GUTSCHEIN"];
  const priced = alleProdukte.filter((p) => p.preisCent > 0);
  const jetzt = new Date();
  let nr = 0;

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function rundGeben(summe: number): number {
    const stufen = [500, 1000, 2000, 5000];
    for (const s of stufen) if (summe <= s) return s;
    return Math.ceil(summe / 1000) * 1000;
  }

  const HIST = 42;
  for (let i = 0; i < HIST; i++) {
    nr++;
    const anzPos = 1 + Math.floor(Math.random() * 3);
    const items: { p: PInfo; menge: number }[] = [];
    for (let k = 0; k < anzPos; k++) items.push({ p: pick(priced), menge: 1 + Math.floor(Math.random() * 3) });
    const summe = items.reduce((s, it) => s + it.p.preisCent * it.menge, 0);
    const kellnerId = pick(kellnerPool);
    const art = pick(zahlarten);
    const when = new Date(jetzt.getTime() - Math.floor(Math.random() * 40) * 3600 * 1000 - Math.floor(Math.random() * 60) * 60000);
    const gegeben = art === "BAR" ? rundGeben(summe) : summe;

    const best = await prisma.bestellung.create({
      data: {
        nummer: nr, status: "ABGESCHLOSSEN",
        bestellStatus: "COMPLETED", zahlungStatus: "PAID", auslieferungStatus: "DELIVERED",
        summeCent: summe, erhaltenCent: gegeben, rueckgeldCent: gegeben - summe, zahlungsart: art,
        kellnerId: kellnerId ?? undefined, tisch: kellnerId ? `Tisch ${1 + Math.floor(Math.random() * 20)}` : null,
        clientRef: `demo-hist-${nr}-${Math.random().toString(36).slice(2, 8)}`,
        verkaufsbereichId: vb.allgemein.id, veranstaltungId: veranstaltung!.id,
        createdAt: when, abgesendetAm: when, abgeschlossenAm: when,
      },
    });
    for (const it of items) {
      await prisma.bestellPosition.create({
        data: {
          bestellungId: best.id, produktId: it.p.id, produktName: it.p.name,
          kategorieName: it.p.katName, verkaufsbereichName: it.p.vbName, arbeitsbereich: it.p.abName, arbeitsbereichId: it.p.abId,
          status: "DELIVERED", einzelpreisCent: it.p.preisCent, menge: it.menge, summeCent: it.p.preisCent * it.menge,
        },
      });
    }
    await prisma.zahlung.create({
      data: { bestellungId: best.id, art, betragCent: summe, gegebenCent: gegeben, rueckgeldCent: gegeben - summe, status: "PAID", benutzerId: kellnerId ?? undefined, zeitpunkt: when },
    });
  }

  const P: Record<string, PInfo> = Object.fromEntries(alleProdukte.map((p) => [p.name, p]));
  async function live(opts: {
    tisch: string; kellnerId: string | null;
    positionen: { name: string; menge: number; posStatus?: string }[];
    ticket: { abId: string; status: string }[];
    auslieferung: string; bestell: string;
  }) {
    nr++;
    const items = opts.positionen.map((x) => ({ p: P[x.name], menge: x.menge, posStatus: x.posStatus ?? "IN_PREPARATION" }));
    const summe = items.reduce((s, it) => s + it.p.preisCent * it.menge, 0);
    const when = new Date(jetzt.getTime() - Math.floor(Math.random() * 12) * 60000);
    const best = await prisma.bestellung.create({
      data: {
        nummer: nr, status: "OFFEN",
        bestellStatus: opts.bestell, zahlungStatus: "UNPAID", auslieferungStatus: opts.auslieferung,
        summeCent: summe, zahlungsart: "BAR",
        kellnerId: opts.kellnerId ?? undefined, tisch: opts.tisch,
        clientRef: `demo-live-${nr}-${Math.random().toString(36).slice(2, 8)}`,
        verkaufsbereichId: vb.allgemein.id, veranstaltungId: veranstaltung!.id,
        createdAt: when, abgesendetAm: when,
      },
    });
    for (const it of items) {
      await prisma.bestellPosition.create({
        data: {
          bestellungId: best.id, produktId: it.p.id, produktName: it.p.name,
          kategorieName: it.p.katName, verkaufsbereichName: it.p.vbName, arbeitsbereich: it.p.abName, arbeitsbereichId: it.p.abId,
          status: it.posStatus, einzelpreisCent: it.p.preisCent, menge: it.menge, summeCent: it.p.preisCent * it.menge,
        },
      });
    }
    for (const t of opts.ticket) {
      await prisma.bereichsticket.create({
        data: {
          bestellungId: best.id, arbeitsbereichId: t.abId, status: t.status,
          angenommenAm: t.status !== "QUEUED" ? when : null,
          fertigAm: t.status === "READY" ? when : null,
        },
      });
    }
  }

  await live({ tisch: "Tisch 7", kellnerId: eva.id, auslieferung: "NOT_READY", bestell: "SUBMITTED",
    positionen: [{ name: "Kotelett", menge: 1, posStatus: "QUEUED" }, { name: "Pommes", menge: 2, posStatus: "QUEUED" }],
    ticket: [{ abId: ab.kueche.id, status: "QUEUED" }] });
  await live({ tisch: "Tisch 12", kellnerId: max.id, auslieferung: "NOT_READY", bestell: "IN_PROGRESS",
    positionen: [{ name: "Bratwürstel", menge: 3, posStatus: "READY" }, { name: "Frankfurter", menge: 2, posStatus: "IN_PREPARATION" }, { name: "Pommes", menge: 1, posStatus: "IN_PREPARATION" }],
    ticket: [{ abId: ab.kueche.id, status: "IN_PREPARATION" }] });
  await live({ tisch: "Tisch 3", kellnerId: max.id, auslieferung: "READY_FOR_PICKUP", bestell: "READY_FOR_PICKUP",
    positionen: [{ name: "Kotelett mit Beilage", menge: 2, posStatus: "READY" }],
    ticket: [{ abId: ab.kueche.id, status: "READY" }] });

  await live({ tisch: "Tisch 9", kellnerId: lukas.id, auslieferung: "NOT_READY", bestell: "IN_PROGRESS",
    positionen: [{ name: "Bier groß", menge: 4, posStatus: "IN_PREPARATION" }, { name: "Radler groß", menge: 2, posStatus: "QUEUED" }],
    ticket: [{ abId: ab.bier.id, status: "IN_PREPARATION" }] });
  await live({ tisch: "Stehtisch 2", kellnerId: eva.id, auslieferung: "NOT_READY", bestell: "SUBMITTED",
    positionen: [{ name: "Bier klein", menge: 3, posStatus: "QUEUED" }],
    ticket: [{ abId: ab.bier.id, status: "QUEUED" }] });

  await live({ tisch: "Tisch 5", kellnerId: max.id, auslieferung: "READY_FOR_PICKUP", bestell: "READY_FOR_PICKUP",
    positionen: [{ name: "Bier groß", menge: 2, posStatus: "READY" }, { name: "Bratwürstel mit Brot", menge: 2, posStatus: "READY" }],
    ticket: [{ abId: ab.bier.id, status: "READY" }, { abId: ab.kueche.id, status: "READY" }] });

  await prisma.zaehler.create({ data: { id: "bestellnummer", wert: nr } });

  const anz = await prisma.produkt.count();
  console.log(`✔ Demo-Seed fertig: ${anz} Produkte (${mitBild} mit Bild), ${HIST} abgeschlossene + 6 laufende Bestellungen, 10 Benutzer, 3 Drucker.`);
  console.log("  Login Admin:  admin / kirchtag");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
