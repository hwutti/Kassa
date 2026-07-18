import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// JWT-Kern für die Admin-Session. Bewusst OHNE next/headers, damit dieses Modul
// auch in der Edge-Middleware verwendet werden kann.

export const SESSION_COOKIE = "kassa_session";
const LAUFZEIT_SEKUNDEN = 12 * 60 * 60; // 12 Stunden

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET fehlt oder ist zu kurz (mind. 16 Zeichen).");
  }
  return new TextEncoder().encode(s);
}

export type SessionDaten = {
  sub: string; // Benutzer-ID
  name: string; // Benutzername
  rolle: string; // ADMIN | KASSA
};

export async function createToken(daten: SessionDaten): Promise<string> {
  return new SignJWT({ name: daten.name, rolle: daten.rolle })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(daten.sub)
    .setIssuedAt()
    .setExpirationTime(`${LAUFZEIT_SEKUNDEN}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionDaten | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payloadToSession(payload);
  } catch {
    return null;
  }
}

function payloadToSession(payload: JWTPayload): SessionDaten | null {
  if (typeof payload.sub !== "string") return null;
  return {
    sub: payload.sub,
    name: typeof payload.name === "string" ? payload.name : "",
    rolle: typeof payload.rolle === "string" ? payload.rolle : "ADMIN",
  };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LAUFZEIT_SEKUNDEN,
};
