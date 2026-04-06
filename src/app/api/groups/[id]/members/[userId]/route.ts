import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resend } from "@/lib/resend";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, userId: targetUserId } = await params;
  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Check requester is admin
  const requesterMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!requesterMembership || requesterMembership.role !== "admin") {
    return NextResponse.json({ error: "Solo los admins pueden cambiar roles" }, { status: 403 });
  }

  // Can't change your own role
  if (targetUserId === session.userId) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  // Check target is a member
  const targetMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Usuario no es miembro del grupo" }, { status: 404 });
  }

  // Don't update if already the same role
  if (targetMembership.role === role) {
    return NextResponse.json({ success: true, role });
  }

  // Update role
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    data: { role },
  });

  // Send email notification when promoting to admin
  if (role === "admin") {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });

    resend.emails.send({
      from: "WeBoard <cesar@tiradacritica.es>",
      to: targetMembership.user.email,
      subject: `¡Ahora eres admin de "${group?.name}" en WeBoard!`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
          <h2 style="color: #f59e0b; margin-bottom: 16px;">WeBoard</h2>
          <p>¡Enhorabuena, ${targetMembership.user.name || "jugador"}! 🎉</p>
          <p>Ahora eres <strong style="color: #f59e0b;">administrador</strong> del grupo <strong style="color: #f59e0b;">"${group?.name}"</strong>.</p>
          <p>Como admin puedes:</p>
          <ul style="color: #94a3b8; font-size: 14px; padding-left: 20px;">
            <li>Marcar juegos como jugados</li>
            <li>Gestionar sesiones y miembros</li>
            <li>Generar y controlar el enlace de invitación</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_URL || "https://weboard-five.vercel.app"}/groups/${groupId}?tab=members" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Ir al grupo
          </a>
        </div>
      `,
    }).catch(() => {}); // Don't fail if email fails
  }

  return NextResponse.json({ success: true, role });
}
