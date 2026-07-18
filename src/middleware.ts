import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

// Schützt den Administrationsbereich (Seiten + API). Läuft in der Edge-Runtime,
// nutzt daher nur den JWT-Kern aus session.ts (kein next/headers).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const istLoginSeite = pathname === "/admin/login";

  // Admin-API: ohne gültige Session 401.
  if (pathname.startsWith("/api/admin")) {
    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin-Seiten (außer Login): ohne Session zur Login-Seite umleiten.
  if (pathname.startsWith("/admin") && !istLoginSeite) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?weiter=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  // Bereits angemeldet + Login-Seite: weiter zum Adminbereich.
  if (istLoginSeite && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
