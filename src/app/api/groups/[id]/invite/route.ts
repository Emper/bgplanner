import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { EMAIL_COLORS, emailButton, emailNote, html, sendAppEmailLater } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { displayName } from "@/lib/users";
import { inviteSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "Este usuario ya es miembro del grupo" },
        { status: 409 }
      );
    }
  }

  // Check for pending invitation
  const pendingInvite = await prisma.groupInvitation.findFirst({
    where: { groupId, email, status: "pending" },
  });

  if (pendingInvite) {
    return NextResponse.json(
      { error: "Ya hay una invitación pendiente para este email" },
      { status: 409 }
    );
  }

  const [group, inviter] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, displayName: true },
    }),
  ]);

  const invitation = await prisma.groupInvitation.create({
    data: { groupId, email },
  });

  const inviterName = displayName(inviter, "Alguien");
  const groupName = group?.name ?? "su grupo";
  sendAppEmailLater({
    to: email,
    subject: `${inviterName} te invita a "${groupName}" en BG Planner`,
    body: html`
      <p><strong>${inviterName}</strong> te ha invitado a unirte al grupo <strong style="color: ${EMAIL_COLORS.accent};">"${groupName}"</strong> en BG Planner.</p>
      <p>BG Planner es una herramienta para organizar y votar qué juegos de mesa jugar con tu grupo.</p>
      ${emailButton(absoluteUrl(`/invite/${invitation.token}`), "Unirme al grupo")}
      ${emailNote("Si no esperabas esta invitación, puedes ignorar este email.")}
    `,
  });

  return NextResponse.json({ success: true, invitation });
}
