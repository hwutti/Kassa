import { PrismaClient } from "@prisma/client";

// Idempotentes Init für BESTEHENDE Installationen: legt Standard-Arbeitsbereiche an
// und ordnet Produkte anhand ihrer Kategorie einem Arbeitsbereich zu.
// Ändert keine Preise/Bestellungen. Beliebig oft ausführbar.

const prisma = new PrismaClient();

// Standard-Arbeitsbereiche (Name -> Icon, Sortierung)
const BEREICHE: { name: string; icon: string; sortierung: number }[] = [
  { name: "Bierausgabe", icon: "🍺", sortierung: 1 },
  { name: "Weinausgabe", icon: "🍷", sortierung: 2 },
  { name: "Getränke (alkoholfrei)", icon: "🥤", sortierung: 3 },
  { name: "Küche", icon: "🍳", sortierung: 4 },
  { name: "Kaffee und Kuchen", icon: "☕", sortierung: 5 },
  { name: "Schnapsausgabe", icon: "🥃", sortierung: 6 },
];

// Kategoriename (Kleinbuchstaben, Teilstring) -> Arbeitsbereichsname
function bereichFuerKategorie(kat: string): string {
  const k = kat.toLowerCase();
  if (k.includes("bier") || k.includes("radler")) return "Bierausgabe";
  if (k.includes("wein") || k.includes("spritzer")) return "Weinausgabe";
  if (k.includes("alkoholfrei") || k.includes("getränk")) return "Getränke (alkoholfrei)";
  if (k.includes("essen") || k.includes("speise") || k.includes("grill") || k.includes("küche")) return "Küche";
  if (k.includes("kaffee") || k.includes("kuchen")) return "Kaffee und Kuchen";
  if (k.includes("schnaps") || k.includes("spirituose")) return "Schnapsausgabe";
  return "Küche"; // Fallback
}

async function main() {
  // Arbeitsbereiche sicherstellen (nach Name).
  const byName = new Map<string, string>();
  for (const b of BEREICHE) {
    const vorhanden = await prisma.arbeitsbereich.findFirst({ where: { name: b.name } });
    const rec = vorhanden ?? (await prisma.arbeitsbereich.create({ data: b }));
    byName.set(b.name, rec.id);
  }

  // Produkte ohne Arbeitsbereich zuordnen.
  const produkte = await prisma.produkt.findMany({
    include: { kategorie: { select: { name: true } }, arbeitsbereiche: { select: { arbeitsbereichId: true } } },
  });
  let zugeordnet = 0;
  for (const p of produkte) {
    if (p.arbeitsbereiche.length > 0) continue; // bereits zugeordnet – nicht überschreiben
    const areaId = byName.get(bereichFuerKategorie(p.kategorie.name));
    if (!areaId) continue;
    await prisma.produktArbeitsbereich.create({
      data: { produktId: p.id, arbeitsbereichId: areaId, primaer: true },
    });
    zugeordnet++;
  }

  console.log(`Init fertig: ${byName.size} Arbeitsbereiche vorhanden, ${zugeordnet} Produkte neu zugeordnet.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
