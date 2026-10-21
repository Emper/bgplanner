import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { EMAIL_COLORS, emailButton, emailNote, html, sendAppEmailLater } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { displayName } from "@/lib/users";
import { inviteSchema } from "@/lib/validations";

export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;

    await requireGroupMember(groupId, session.userId);
    const { email } = await parseBody(request, inviteSchema);

    // ¿Ya está dentro, o ya tiene una invitación esperando?
    const [existingMember, pendingInvite, group, inviter] = await Promise.all([
      prisma.groupMember.findFirst({
        where: { groupId, user: { email } },
        select: { id: true },
      }),
      prisma.groupInvitation.findFirst({
        where: { groupId, email, status: "pending" },
        select: { id: true },
      }),
      prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, displayName: true },
      }),
    ]);

    if (existingMember) {
      throw new ApiError(409, "Este usuario ya es miembro del grupo");
    }
    if (pendingInvite) {
      throw new ApiError(409, "Ya hay una invitación pendiente para este email");
    }

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
);
