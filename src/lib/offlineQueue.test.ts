import { describe, it, expect } from "vitest";
import { addToQueue, removeFromQueue, type QueuedOrder } from "./offlineQueue";

const mk = (clientRef: string): QueuedOrder => ({
  clientRef,
  tisch: "1",
  gast: null,
  notiz: null,
  positionen: [{ produktId: "p1", menge: 1 }],
  gestelltAm: 0,
  anzahl: 1,
  summeCent: 450,
});

describe("addToQueue", () => {
  it("fügt eine neue Bestellung hinzu", () => {
    const l = addToQueue([], mk("a"));
    expect(l).toHaveLength(1);
    expect(l[0].clientRef).toBe("a");
  });
  it("verhindert Duplikate über clientRef (Idempotenz)", () => {
    const l1 = addToQueue([], mk("a"));
    const l2 = addToQueue(l1, mk("a"));
    expect(l2).toHaveLength(1);
  });
  it("behält bestehende und hängt neue an", () => {
    const l = addToQueue(addToQueue([], mk("a")), mk("b"));
    expect(l.map((x) => x.clientRef)).toEqual(["a", "b"]);
  });
});

describe("removeFromQueue", () => {
  it("entfernt die passende Bestellung, behält den Rest", () => {
    const l = addToQueue(addToQueue([], mk("a")), mk("b"));
    const r = removeFromQueue(l, "a");
    expect(r.map((x) => x.clientRef)).toEqual(["b"]);
  });
  it("lässt die Liste unverändert, wenn nichts passt", () => {
    const l = addToQueue([], mk("a"));
    expect(removeFromQueue(l, "x")).toHaveLength(1);
  });
});
