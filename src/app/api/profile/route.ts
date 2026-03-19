import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { profileSchema } from "@/lib/validations";
import { validateBggUsername } from "@/lib/bgg";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      location: true,
      bggUsername: true,
    },
  });

  return NextResponse.json(user);
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Validate BGG username if provided
  const data = { ...parsed.data };
  if (data.bggUsername && data.bggUsername.trim()) {
    data.bggUsername = data.bggUsername.trim().toLowerCase();
    const validation = await validateBggUsername(data.bggUsername);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      location: true,
      bggUsername: true,
    },
  });

  return NextResponse.json(user);
}
