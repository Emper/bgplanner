import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("60d")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export async function getSession(
  req?: NextRequest
): Promise<{ userId: string; email: string } | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get("session")?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get("session")?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

export async function getSuperadminEmails(): Promise<string[]> {
  const superadmins = await prisma.user.findMany({
    where: { role: "superadmin" },
    select: { email: true },
  });
  if (superadmins.length > 0) {
    return superadmins.map((u) => u.email);
  }
  return process.env.SUPERADMIN_EMAIL ? [process.env.SUPERADMIN_EMAIL] : [];
}

export async function isSuperadmin(
  session: { userId: string; email: string } | null
): Promise<boolean> {
  if (!session) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (user?.role === "superadmin") return true;
  const fallback = process.env.SUPERADMIN_EMAIL;
  return !!fallback && fallback.toLowerCase() === session.email.toLowerCase();
}

export function sessionCookieOptions(token: string) {
  return {
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  };
}
