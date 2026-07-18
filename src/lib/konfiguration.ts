import { prisma } from "@/lib/prisma";

/** Liefert (und erstellt bei Bedarf) den einzeiligen Einstellungs-Datensatz. */
export async function getEinstellung() {
  return prisma.einstellung.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app" },
  });
}
