import { PrismaClient, Prisma } from "@prisma/client";
import { hashPasswort } from "../src/lib/passwort";

// Legt beim ERSTEN Mal einen Administrator an. Bei bestehendem Admin wird das
// Passwort NICHT verändert (sonst würde jedes Update das Passwort zurücksetzen) –
// es werden nur Rolle ADMIN + aktiv sichergestellt (nicht aussperrbar).
// Bewusstes Zurücksetzen des Passworts: FORCE_ADMIN_PW=1 zusammen mit ADMIN_PASSWORT.

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_BENUTZER || "admin";
  const pass = process.env.ADMIN_PASSWORT;
  const force = process.env.FORCE_ADMIN_PW === "1";

  const vorhanden = await prisma.benutzer.findUnique({ where: { benutzername: name }, select: { id: true } });

  if (!vorhanden) {
    if (!pass || pass.length < 4) {
      console.error("Fehler: ADMIN_PASSWORT (min. 4 Zeichen) für die Erst-Anlage nötig.");
      process.exit(1);
    }
    await prisma.benutzer.create({
      data: { benutzername: name, passwortHash: hashPasswort(pass), rolle: "ADMIN", aktiv: true },
    });
    console.log(`Administrator "${name}" neu angelegt.`);
    return;
  }

  // Bestehender Admin: Rolle/aktiv sichern, Passwort nur auf Wunsch überschreiben.
  const data: Prisma.BenutzerUpdateInput = { rolle: "ADMIN", aktiv: true };
  if (force) {
    if (!pass || pass.length < 4) {
      console.error("Fehler: FORCE_ADMIN_PW=1 gesetzt, aber ADMIN_PASSWORT fehlt/zu kurz.");
      process.exit(1);
    }
    data.passwortHash = hashPasswort(pass);
  }
  await prisma.benutzer.update({ where: { benutzername: name }, data });
  console.log(
    `Administrator "${name}" aktualisiert (Rolle ADMIN, aktiv${force ? ", Passwort zurückgesetzt" : ", Passwort unverändert"}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
