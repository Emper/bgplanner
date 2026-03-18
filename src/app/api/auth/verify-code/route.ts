import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { otpSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = otpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const otpCode = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpCode) {
    return NextResponse.json(
      { error: "Código inválido o expirado" },
      { status: 401 }
    );
  }

  await prisma.otpCode.update({
    where: { id: otpCode.id },
    data: { used: true },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const token = await signToken({ userId: user.id, email: user.email });
  const cookie = sessionCookieOptions(token);

  const response = NextResponse.json({
    success: true,
    isNewUser: !user.name,
  });

  response.cookies.set(cookie);
  return response;
}
