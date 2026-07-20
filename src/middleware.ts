import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

// Schützt Adminbereich + rollenspezifische Bereiche. Läuft in der Edge-Runtime,
// nutzt daher nur den JWT-Kern aus session.ts (kein next/headers).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const istLoginSeite = pathname === "/admin/login";

  // Admin-API: gültige Session + Rolle ADMIN.
  if (pathname.startsWith("/api/admin")) {
    if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    if (session.rolle !== "ADMIN") return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    return NextResponse.next();
  }

  // Rollen-APIs: gültige Session (Feinprüfung im Handler).
  if (pathname.startsWith("/api/kellner") || pathname.startsWith("/api/bereich") || pathname.startsWith("/api/uebersicht")) {
    if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    return NextResponse.next();
  }

  // Geschützte Seiten -> ohne Session zur Login-Seite.
  const geschuetzteSeite =
    (pathname.startsWith("/admin") && !istLoginSeite) ||
    pathname.startsWith("/kellner") ||
    pathname.startsWith("/bereich") ||
    pathname.startsWith("/uebersicht");
  if (geschuetzteSeite && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?weiter=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  // Adminseiten nur für ADMIN.
  if (pathname.startsWith("/admin") && !istLoginSeite && session && session.rolle !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/kellner";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (istLoginSeite && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.rolle === "ADMIN" ? "/admin" : session.rolle === "BEREICH" ? "/bereich" : session.rolle === "SUPERVISOR" ? "/uebersicht" : "/kellner";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/kellner/:path*",
    "/bereich/:path*",
    "/uebersicht/:path*",
    "/api/kellner/:path*",
    "/api/bereich/:path*",
    "/api/uebersicht/:path*",
  ],
};
