import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
  });

  if (!invitation || invitation.groupId !== groupId) {
    return NextResponse.json(
      { error: "Invitación no válida" },
      { status: 404 }
    );
  }

  if (invitation.status !== "pending") {
    return NextResponse.json(
      { error: "Esta invitación ya fue utilizada" },
      { status: 410 }
    );
  }

  // El email del JWT puede quedarse viejo (la sesión dura 60 días y el
  // usuario puede haber cambiado de email), así que se compara con el de BD.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  if (
    !user ||
    invitation.email.toLowerCase() !== user.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Esta invitación es para otro email" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (existing) {
    await prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
    return NextResponse.json({ success: true, alreadyMember: true });
  }

  await prisma.$transaction([
    prisma.groupMember.create({
      data: { groupId, userId: session.userId, role: "member" },
    }),
    prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
