import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Las fichas de un grupo y de un evento se resuelven ellas solas: con sesión
// enseñan el panel completo y sin ella la versión pública. Su tarjeta para
// compartir (opengraph-image) es una ruta hija y también tiene que pasar, o
// las vistas previas se quedan en la pantalla de login. El resto de /groups y
// /events (el listado, crear, añadir juegos…) sigue pidiendo cuenta.
const PUBLIC_DETAIL =
  /^\/(groups|events)\/(?!new$)[^/]+(\/opengraph-image)?$/;

export async function proxy(request: NextRequest) {
  if (PUBLIC_DETAIL.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;

  if (!token) {
    return handleUnauthorized(request);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return handleUnauthorized(request);
  }

  return NextResponse.next();
}

function handleUnauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/groups/:path*",
    "/events/:path*",
    // `:path*` casa también con la ruta sin sufijo, así que esto cubre
    // /collection y /api/collection además de sus subrutas.
    "/collection/:path*",
    "/api/collection/:path*",
    "/api/profile/:path*",
    "/api/groups/:path*",
    "/api/events/:path*",
    "/api/bgg/:path*",
  ],
};
