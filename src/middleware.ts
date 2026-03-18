import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
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

  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/groups/:path*",
    "/api/profile/:path*",
    "/api/groups/:path*",
    "/api/bgg/:path*",
  ],
};
