import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resend } from "@/lib/resend";
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  const invitation = await prisma.groupInvitation.create({
    data: { groupId, email },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;

  await resend.emails.send({
    from: "WeBoard <cesar@tiradacritica.es>",
    to: email,
    subject: `${inviter?.name || inviter?.email} te invita a "${group?.name}" en WeBoard`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">WeBoard</h2>
        <p><strong>${inviter?.name || inviter?.email}</strong> te ha invitado a unirte al grupo <strong style="color: #f59e0b;">"${group?.name}"</strong> en WeBoard.</p>
        <p>WeBoard es una herramienta para organizar y votar qué juegos de mesa jugar con tu grupo.</p>
        <a href="${inviteUrl}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
          Unirme al grupo
        </a>
        <p style="color: #94a3b8; font-size: 14px;">Si no esperabas esta invitación, puedes ignorar este email.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true, invitation });
}
