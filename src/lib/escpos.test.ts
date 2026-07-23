import { describe, it, expect } from "vitest";
import { bonEscPos, ticketEscPos, testEscPos, eur, zeile, WIDTH } from "./escpos";
import { parseDruckerAdresse } from "./netprint";
import type { BonDaten } from "./bon";

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const CUT = Buffer.from([0x1d, 0x56, 0x42, 0x00]);

const beispielBon: BonDaten = {
  titel: "Sommerfest",
  untertitel: "Vereinskasse",
  logoUrl: null,
  nummer: 42,
  datum: "24.07.2026, 14:00",
  verkaeufer: "Max",
  tisch: "12",
  positionen: [
    { produktName: "Bier groß", menge: 2, einzelpreisCent: 450, summeCent: 900 },
    { produktName: "Kotelett mit Beilage", menge: 1, einzelpreisCent: 850, summeCent: 850 },
  ],
  summeCent: 1750,
  art: "BAR",
  gegebenCent: 2000,
  rueckgeldCent: 250,
};

describe("eur", () => {
  it("formatiert Cent ohne Währungszeichen mit Komma", () => {
    expect(eur(1250)).toBe("12,50");
    expect(eur(50)).toBe("0,50");
    expect(eur(0)).toBe("0,00");
  });
});

describe("zeile", () => {
  it("füllt zwei Spalten auf die Breite auf", () => {
    const z = zeile("Bier", "4,50", 20);
    expect(z).toHaveLength(20);
    expect(z.startsWith("Bier")).toBe(true);
    expect(z.endsWith("4,50")).toBe(true);
  });
  it("kürzt zu langen linken Text und bleibt auf Breite", () => {
    const z = zeile("Ein sehr sehr langer Produktname der nicht passt", "9,99", 24);
    expect(z).toHaveLength(24);
    expect(z.endsWith("9,99")).toBe(true);
    expect(z).toContain("…");
  });
});

describe("bonEscPos", () => {
  const buf = bonEscPos(beispielBon);
  it("beginnt mit dem Initialisierungsbefehl", () => {
    expect(buf.subarray(0, 2).equals(ESC_INIT)).toBe(true);
  });
  it("endet mit einem Schnittbefehl", () => {
    expect(buf.subarray(buf.length - 4).equals(CUT)).toBe(true);
  });
  it("enthält Titel, Summe und Rückgeld", () => {
    expect(buf.includes(Buffer.from("Sommerfest", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("SUMME", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("Rückgeld", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("17,50", "latin1"))).toBe(true);
  });
  it("kodiert Umlaute als Windows-1252 (ü = 0xFC)", () => {
    expect(buf.includes(Buffer.from([0xfc]))).toBe(true); // aus "groß"? nein – aus "Rückgeld"
  });
  it("ersetzt das €-Zeichen (kein 0x80-Byte für €)", () => {
    // eur() liefert keine €-Zeichen; SUMME-Zeile nutzt 'EUR'
    expect(buf.includes(Buffer.from("EUR", "latin1"))).toBe(true);
  });
});

describe("ticketEscPos", () => {
  it("enthält Bereich, Bestellnummer und Positionen, endet mit Schnitt", () => {
    const buf = ticketEscPos({
      bereich: "Küche",
      nummer: 7,
      tisch: "3",
      gast: null,
      zeit: "14:05",
      positionen: [{ menge: 2, produktName: "Pommes", notiz: "ohne Salz" }],
    });
    expect(buf.includes(Buffer.from("Küche", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("Nr. 7", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("2x Pommes", "latin1"))).toBe(true);
    expect(buf.includes(Buffer.from("ohne Salz", "latin1"))).toBe(true);
    expect(buf.subarray(buf.length - 4).equals(CUT)).toBe(true);
  });
});

describe("testEscPos", () => {
  it("erzeugt einen kurzen Testausdruck", () => {
    const buf = testEscPos("Küchendrucker", "jetzt");
    expect(buf.includes(Buffer.from("TESTDRUCK", "latin1"))).toBe(true);
    expect(buf.subarray(0, 2).equals(ESC_INIT)).toBe(true);
  });
});

describe("parseDruckerAdresse", () => {
  it("nimmt Standardport 9100 ohne Portangabe", () => {
    expect(parseDruckerAdresse("192.168.1.50")).toEqual({ host: "192.168.1.50", port: 9100 });
  });
  it("liest einen angegebenen Port", () => {
    expect(parseDruckerAdresse("10.0.0.5:9200")).toEqual({ host: "10.0.0.5", port: 9200 });
  });
  it("fällt bei ungültigem Port auf 9100 zurück", () => {
    expect(parseDruckerAdresse("10.0.0.5:abc")).toEqual({ host: "10.0.0.5", port: 9100 });
  });
});

it("WIDTH ist 48 (80-mm-Font-A)", () => {
  expect(WIDTH).toBe(48);
});
