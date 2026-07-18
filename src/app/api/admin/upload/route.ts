import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Erlaubte Bildtypen werden anhand der Magic Bytes geprüft (nicht nur Content-Type).
// SVG ist bewusst NICHT erlaubt (kann Skripte enthalten).
function erkenneTyp(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

/** POST /api/admin/upload – nimmt ein Produktbild entgegen (multipart, Feld "datei"). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const datei = form.get("datei");
    if (!(datei instanceof File)) {
      return fehler("Keine Datei übermittelt.", 400);
    }
    if (datei.size > MAX_BYTES) {
      return fehler("Datei zu groß (max. 2 MB).", 413);
    }

    const buf = Buffer.from(await datei.arrayBuffer());
    const typ = erkenneTyp(buf);
    if (!typ) {
      return fehler("Nur PNG-, JPG- oder WebP-Bilder sind erlaubt.", 415);
    }

    // Sicherer, zufälliger Dateiname – der vom Client gelieferte Name wird ignoriert.
    const name = `${randomBytes(16).toString("hex")}.${typ}`;
    const zielVerzeichnis = path.join(process.cwd(), "public", "uploads");
    await mkdir(zielVerzeichnis, { recursive: true });
    await writeFile(path.join(zielVerzeichnis, name), buf);

    return ok({ url: `/uploads/${name}` }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
