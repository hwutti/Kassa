import { PrismaClient } from "@prisma/client";
import { hashPasswort } from "../src/lib/passwort";

const prisma = new PrismaClient();

// WICHTIG (Spec §7): Verkaufspreise werden NICHT geseedet. Alle Produkte starten
// ohne Preis ("Preis fehlt") und erhalten ihren Preis ausschließlich im Adminbereich.

async function main() {
  console.log("Seed: räume bestehende Stammdaten auf …");
  await prisma.bestellPosition.deleteMany();
  await prisma.bestellung.deleteMany();
  await prisma.preishistorie.deleteMany();
  await prisma.produktVerkaufsbereich.deleteMany();
  await prisma.produkt.deleteMany();
  await prisma.kategorie.deleteMany();
  await prisma.verkaufsbereich.deleteMany();
  await prisma.veranstaltung.deleteMany();
  await prisma.zaehler.deleteMany();

  await prisma.zaehler.create({ data: { id: "bestellnummer", wert: 0 } });

  // Anwendungs-Einstellungen (Header-Titel).
  await prisma.einstellung.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app", titel: "Kirchtagsfest Kasse", untertitel: "Festkasse" },
  });

  // Standard-Veranstaltung (aktiv) – neue Bestellungen werden ihr zugeordnet.
  await prisma.veranstaltung.create({
    data: { name: "Kirchtagsfest", beschreibung: "Standard-Veranstaltung", aktiv: true },
  });

  // --- Administrator (Passwort aus Umgebungsvariable, sonst Standard mit Warnung) ---
  const adminName = process.env.ADMIN_BENUTZER || "admin";
  const adminPass = process.env.ADMIN_PASSWORT || "kirchtag";
  if (!process.env.ADMIN_PASSWORT) {
    console.warn(
      "⚠  ADMIN_PASSWORT nicht gesetzt – lege Admin mit Standardpasswort 'kirchtag' an. Bitte nach dem ersten Login ändern!",
    );
  }
  await prisma.benutzer.upsert({
    where: { benutzername: adminName },
    update: {},
    create: { benutzername: adminName, passwortHash: hashPasswort(adminPass), rolle: "ADMIN" },
  });

  // --- Verkaufsbereiche (Spec §4) ---
  const vb = {
    getraenke: await prisma.verkaufsbereich.create({
      data: { name: "Getränkeausschank", icon: "🍹", beschreibung: "Alle Getränke", sortierung: 1 },
    }),
    bier: await prisma.verkaufsbereich.create({
      data: { name: "Bier und Radler", icon: "🍺", sortierung: 2 },
    }),
    wein: await prisma.verkaufsbereich.create({
      data: { name: "Wein und Spritzer", icon: "🍷", sortierung: 3 },
    }),
    kueche: await prisma.verkaufsbereich.create({
      data: { name: "Küche und Grill", icon: "🔥", sortierung: 4 },
    }),
    kaffee: await prisma.verkaufsbereich.create({
      data: { name: "Kaffee und Kuchen", icon: "☕", sortierung: 5 },
    }),
    schnaps: await prisma.verkaufsbereich.create({
      data: { name: "Schnaps und Spirituosen", icon: "🥃", sortierung: 6 },
    }),
    allgemein: await prisma.verkaufsbereich.create({
      data: {
        name: "Allgemeine Kassa",
        icon: "🧾",
        beschreibung: "Zeigt alle gültigen, aktiven Produkte",
        istAllgemein: true,
        sortierung: 7,
      },
    }),
  };

  // --- Kategorien (Spec §5) ---
  const kat = {
    bier: await prisma.kategorie.create({
      data: { name: "Bier und Radler", icon: "🍺", farbe: "#f59e0b", sortierung: 1 },
    }),
    wein: await prisma.kategorie.create({
      data: { name: "Wein und Spritzer", icon: "🍷", farbe: "#b91c1c", sortierung: 2 },
    }),
    afrei: await prisma.kategorie.create({
      data: { name: "Alkoholfreie Getränke", icon: "🥤", farbe: "#2563eb", sortierung: 3 },
    }),
    essen: await prisma.kategorie.create({
      data: { name: "Essen", icon: "🍽️", farbe: "#16a34a", sortierung: 4 },
    }),
    kaffee: await prisma.kategorie.create({
      data: { name: "Kaffee und Kuchen", icon: "☕", farbe: "#92400e", sortierung: 5 },
    }),
    schnaps: await prisma.kategorie.create({
      data: { name: "Schnaps und Spirituosen", icon: "🥃", farbe: "#7c3aed", sortierung: 6 },
    }),
  };

  // Hilfsfunktion: Produkt OHNE Preis anlegen und Bereichen zuordnen.
  let sort = 0;
  async function p(name: string, kategorieId: string, icon: string, bereiche: string[]) {
    const prod = await prisma.produkt.create({
      data: { name, kategorieId, icon, preisCent: null, sortierung: ++sort },
    });
    for (const b of bereiche) {
      await prisma.produktVerkaufsbereich.create({
        data: { produktId: prod.id, verkaufsbereichId: b },
      });
    }
  }

  // Bier und Radler
  await p("Bier klein", kat.bier.id, "🍺", [vb.bier.id, vb.getraenke.id]);
  await p("Bier groß", kat.bier.id, "🍺", [vb.bier.id, vb.getraenke.id]);
  await p("Radler klein", kat.bier.id, "🍻", [vb.bier.id, vb.getraenke.id]);
  await p("Radler groß", kat.bier.id, "🍻", [vb.bier.id, vb.getraenke.id]);
  await p("Alkoholfreies Bier", kat.bier.id, "🍺", [vb.bier.id, vb.getraenke.id]);

  // Wein und Spritzer
  await p("Weißwein 1/8 Liter", kat.wein.id, "🍷", [vb.wein.id, vb.getraenke.id]);
  await p("Weißwein 1/4 Liter", kat.wein.id, "🍷", [vb.wein.id, vb.getraenke.id]);
  await p("Rotwein 1/8 Liter", kat.wein.id, "🍷", [vb.wein.id, vb.getraenke.id]);
  await p("Rotwein 1/4 Liter", kat.wein.id, "🍷", [vb.wein.id, vb.getraenke.id]);
  await p("Weißer Spritzer klein", kat.wein.id, "🥂", [vb.wein.id, vb.getraenke.id]);
  await p("Weißer Spritzer groß", kat.wein.id, "🥂", [vb.wein.id, vb.getraenke.id]);
  await p("Roter Spritzer klein", kat.wein.id, "🥂", [vb.wein.id, vb.getraenke.id]);
  await p("Roter Spritzer groß", kat.wein.id, "🥂", [vb.wein.id, vb.getraenke.id]);
  await p("Sommerspritzer", kat.wein.id, "🥂", [vb.wein.id, vb.getraenke.id]);

  // Alkoholfreie Getränke
  await p("Limonade klein", kat.afrei.id, "🥤", [vb.getraenke.id]);
  await p("Limonade groß", kat.afrei.id, "🥤", [vb.getraenke.id]);
  await p("Cola klein", kat.afrei.id, "🥤", [vb.getraenke.id]);
  await p("Cola groß", kat.afrei.id, "🥤", [vb.getraenke.id]);
  await p("Mineralwasser", kat.afrei.id, "💧", [vb.getraenke.id]);
  await p("Apfelsaft", kat.afrei.id, "🧃", [vb.getraenke.id]);
  await p("Apfelsaft gespritzt", kat.afrei.id, "🧃", [vb.getraenke.id]);
  await p("Orangensaft", kat.afrei.id, "🍊", [vb.getraenke.id]);
  await p("Kindergetränk", kat.afrei.id, "🧒", [vb.getraenke.id]);

  // Essen
  await p("Bratwürstel", kat.essen.id, "🌭", [vb.kueche.id]);
  await p("Bratwürstel mit Brot", kat.essen.id, "🌭", [vb.kueche.id]);
  await p("Kotelett", kat.essen.id, "🍖", [vb.kueche.id]);
  await p("Kotelett mit Beilage", kat.essen.id, "🍖", [vb.kueche.id]);
  await p("Grillteller", kat.essen.id, "🍽️", [vb.kueche.id]);
  await p("Pommes", kat.essen.id, "🍟", [vb.kueche.id]);
  await p("Frankfurter", kat.essen.id, "🌭", [vb.kueche.id]);
  await p("Brot", kat.essen.id, "🍞", [vb.kueche.id]);
  await p("Portion Senf", kat.essen.id, "🥫", [vb.kueche.id]);

  // Kaffee und Kuchen
  await p("Kaffee", kat.kaffee.id, "☕", [vb.kaffee.id]);
  await p("Verlängerter", kat.kaffee.id, "☕", [vb.kaffee.id]);
  await p("Espresso", kat.kaffee.id, "☕", [vb.kaffee.id]);
  await p("Cappuccino", kat.kaffee.id, "☕", [vb.kaffee.id]);
  await p("Tee", kat.kaffee.id, "🍵", [vb.kaffee.id]);
  await p("Kuchen", kat.kaffee.id, "🍰", [vb.kaffee.id]);
  await p("Torte", kat.kaffee.id, "🎂", [vb.kaffee.id]);
  await p("Kaffee und Kuchen", kat.kaffee.id, "☕", [vb.kaffee.id]);

  // Schnaps und Spirituosen
  await p("Obstler", kat.schnaps.id, "🥃", [vb.schnaps.id]);
  await p("Williams", kat.schnaps.id, "🥃", [vb.schnaps.id]);
  await p("Marillenschnaps", kat.schnaps.id, "🥃", [vb.schnaps.id]);
  await p("Kräuterschnaps", kat.schnaps.id, "🥃", [vb.schnaps.id]);
  await p("Zirbenschnaps", kat.schnaps.id, "🥃", [vb.schnaps.id]);
  await p("Likör", kat.schnaps.id, "🍸", [vb.schnaps.id]);
  await p("Schnapsmischung", kat.schnaps.id, "🥃", [vb.schnaps.id]);

  const anzahl = await prisma.produkt.count();
  console.log(`Seed abgeschlossen: ${anzahl} Produkte (ohne Preis – bitte im Admin pflegen).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
