import { PrismaClient } from "@prisma/client";
import { hashPasswort } from "../src/lib/passwort";

// Legt einen Administrator an oder setzt dessen Passwort zurück (idempotent).
// Zugangsdaten kommen aus Umgebungsvariablen – niemals hartkodiert.

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_BENUTZER || "admin";
  const pass = process.env.ADMIN_PASSWORT;
  if (!pass || pass.length < 4) {
    console.error("Fehler: ADMIN_PASSWORT (min. 4 Zeichen) muss gesetzt sein.");
    process.exit(1);
  }
  await prisma.benutzer.upsert({
    where: { benutzername: name },
    // Beim Zurücksetzen IMMER wieder zum aktiven Administrator machen
    // (behebt versehentlich geänderte Rolle / deaktivierten Zugang → nicht aussperrbar).
    update: { passwortHash: hashPasswort(pass), aktiv: true, rolle: "ADMIN" },
    create: { benutzername: name, passwortHash: hashPasswort(pass), rolle: "ADMIN" },
  });
  console.log(`Administrator "${name}" angelegt/aktualisiert (Rolle ADMIN, aktiv).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
