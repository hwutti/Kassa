import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite für parallelen Betrieb härten: WAL-Modus (Leser blockieren Schreiber nicht)
// + busy_timeout (kurze Wartezeit statt sofortigem "database is locked").
// Einmalig pro Prozess, best effort.
const g = globalForPrisma as unknown as { sqlitePragmasGesetzt?: boolean };
if (!g.sqlitePragmasGesetzt) {
  g.sqlitePragmasGesetzt = true;
  Promise.resolve()
    .then(async () => {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");
      await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");
    })
    .catch(() => {
      /* z. B. nicht-SQLite-Datenbank – ignorieren */
    });
}
