import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed: räume bestehende Daten auf …");
  await prisma.bestellPosition.deleteMany();
  await prisma.bestellung.deleteMany();
  await prisma.produktVerkaufsbereich.deleteMany();
  await prisma.produkt.deleteMany();
  await prisma.kategorie.deleteMany();
  await prisma.verkaufsbereich.deleteMany();
  await prisma.zaehler.deleteMany();

  // Bestellnummern-Zähler initialisieren.
  await prisma.zaehler.create({ data: { id: "bestellnummer", wert: 0 } });

  // --- Verkaufsbereiche ---
  const cafeteria = await prisma.verkaufsbereich.create({
    data: { name: "Cafeteria", aktiv: true, sortierung: 1 },
  });
  const kiosk = await prisma.verkaufsbereich.create({
    data: { name: "Kiosk", aktiv: true, sortierung: 2 },
  });
  const sommerfest = await prisma.verkaufsbereich.create({
    // Inaktiver Bereich: dessen Produkte dürfen in der Kasse nicht erscheinen.
    data: { name: "Sommerfest (inaktiv)", aktiv: false, sortierung: 3 },
  });

  // --- Kategorien ---
  const getraenke = await prisma.kategorie.create({
    data: { name: "Getränke", aktiv: true, sortierung: 1, farbe: "#2563eb" },
  });
  const speisen = await prisma.kategorie.create({
    data: { name: "Speisen", aktiv: true, sortierung: 2, farbe: "#f59e0b" },
  });
  const snacks = await prisma.kategorie.create({
    data: { name: "Snacks", aktiv: true, sortierung: 3, farbe: "#10b981" },
  });
  const saison = await prisma.kategorie.create({
    // Inaktive Kategorie: deren Produkte dürfen in der Kasse nicht erscheinen.
    data: { name: "Saison (inaktiv)", aktiv: false, sortierung: 4 },
  });

  // Hilfsfunktion: Produkt anlegen und Bereichen zuordnen.
  async function produkt(opts: {
    name: string;
    kategorieId: string;
    preisCent: number | null;
    aktiv?: boolean;
    bereiche: string[];
    sortierung?: number;
  }) {
    const p = await prisma.produkt.create({
      data: {
        name: opts.name,
        kategorieId: opts.kategorieId,
        preisCent: opts.preisCent,
        aktiv: opts.aktiv ?? true,
        sortierung: opts.sortierung ?? 0,
      },
    });
    for (const b of opts.bereiche) {
      await prisma.produktVerkaufsbereich.create({
        data: { produktId: p.id, verkaufsbereichId: b },
      });
    }
    return p;
  }

  // --- Sichtbare Produkte (alle Bedingungen erfüllt) ---
  await produkt({ name: "Kaffee", kategorieId: getraenke.id, preisCent: 250, bereiche: [cafeteria.id, kiosk.id], sortierung: 1 });
  await produkt({ name: "Mineralwasser 0,5 l", kategorieId: getraenke.id, preisCent: 180, bereiche: [cafeteria.id, kiosk.id], sortierung: 2 });
  await produkt({ name: "Apfelsaft 0,3 l", kategorieId: getraenke.id, preisCent: 220, bereiche: [cafeteria.id], sortierung: 3 });
  await produkt({ name: "Leberkässemmel", kategorieId: speisen.id, preisCent: 390, bereiche: [cafeteria.id], sortierung: 1 });
  await produkt({ name: "Gulaschsuppe", kategorieId: speisen.id, preisCent: 450, bereiche: [cafeteria.id], sortierung: 2 });
  await produkt({ name: "Schokoriegel", kategorieId: snacks.id, preisCent: 150, bereiche: [cafeteria.id, kiosk.id], sortierung: 1 });
  await produkt({ name: "Salzstangerl", kategorieId: snacks.id, preisCent: 120, bereiche: [kiosk.id], sortierung: 2 });
  await produkt({ name: "Gratis-Kostprobe", kategorieId: snacks.id, preisCent: 0, bereiche: [cafeteria.id], sortierung: 3 }); // Preis 0 ist gültig

  // --- Produkte, die NICHT in der Kasse erscheinen dürfen (Testfälle) ---
  // 1) Preis fehlt (preisCent = NULL)
  await produkt({ name: "Neuer Smoothie (Preis fehlt)", kategorieId: getraenke.id, preisCent: null, bereiche: [cafeteria.id, kiosk.id] });
  // 2) Produkt inaktiv
  await produkt({ name: "Eistee (inaktiv)", kategorieId: getraenke.id, preisCent: 200, aktiv: false, bereiche: [cafeteria.id] });
  // 3) Kategorie inaktiv
  await produkt({ name: "Glühwein (inaktive Kategorie)", kategorieId: saison.id, preisCent: 350, bereiche: [cafeteria.id] });
  // 4) Nur im inaktiven Verkaufsbereich zugeordnet
  await produkt({ name: "Festbier (inaktiver Bereich)", kategorieId: getraenke.id, preisCent: 480, bereiche: [sommerfest.id] });

  console.log("Seed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
