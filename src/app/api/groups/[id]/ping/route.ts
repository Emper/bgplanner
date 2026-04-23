import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { pingSchema } from "@/lib/validations";
import { computeRanking } from "@/lib/ranking";
import { logActivity } from "@/lib/activity";

const PING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  if (membership.lastPingedAt) {
    const elapsed = Date.now() - membership.lastPingedAt.getTime();
    if (elapsed < PING_COOLDOWN_MS) {
      const nextAvailableAt = new Date(
        membership.lastPingedAt.getTime() + PING_COOLDOWN_MS
      );
      return NextResponse.json(
        {
          error: "Solo puedes convocar una vez por semana",
          nextAvailableAt: nextAvailableAt.toISOString(),
        },
        { status: 429 }
      );
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = pingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const rawMessage = parsed.data.message?.trim() || "";
  const customMessage = rawMessage ? escapeHtml(rawMessage) : "";

  const [group, sender, ranking] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { userId: { not: session.userId } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, displayName: true, email: true },
    }),
    computeRanking(groupId),
  ]);

  if (!group || !sender) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const senderName =
    sender.displayName || sender.name || sender.email || "Un miembro";
  const top3 = ranking.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const groupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/groups/${groupId}`;

  const top3Html = top3.length
    ? `
      <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 12px; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Así va el ranking</p>
        ${top3
          .map(
            (g, i) =>
              `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: ${
                i < top3.length - 1 ? "1px solid #334155" : "none"
              };">
                <span style="color: #f1f5f9;">${medals[i]} ${escapeHtml(
                g.game.name
              )}</span>
                <span style="color: #f59e0b; font-weight: bold;">${g.score} pts</span>
              </div>`
          )
          .join("")}
      </div>`
    : "";

  const customMessageHtml = customMessage
    ? `<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #f59e0b; background: #1e293b; color: #e2e8f0; font-style: italic; border-radius: 4px;">"${customMessage}"</blockquote>`
    : "";

  const subject = `🎲 ${senderName} quiere jugar — vota tus favoritos en "${group.name}"`;

  const buildHtml = () => `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
      <h2 style="color: #f59e0b; margin: 0 0 8px;">BG Planner</h2>
      <p style="margin: 0 0 16px; font-size: 18px;"><strong>¡Tirada a la vista!</strong> 🎲</p>
      <p>
        <strong>${escapeHtml(senderName)}</strong> quiere organizar la próxima partida de
        <strong style="color: #f59e0b;">"${escapeHtml(group.name)}"</strong>
        y necesita tu ayuda para decidir a qué jugar.
      </p>
      ${customMessageHtml}
      ${top3Html}
      <p>Echa un vistazo, revisa tus preferencias y vota tus favoritos 👇</p>
      <a href="${groupUrl}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 12px 0;">
        Votar en el ranking
      </a>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">Nos vemos en la mesa 🎲<br/>— El equipo de BG Planner</p>
    </div>
  `;

  const recipients = group.members
    .map((m) => m.user.email)
    .filter((e): e is string => Boolean(e));

  await Promise.all(
    recipients.map((to) =>
      resend.emails
        .send({
          from: "BG Planner <cesar@tiradacritica.es>",
          to,
          subject,
          html: buildHtml(),
        })
        .catch(() => {})
    )
  );

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: session.userId } },
    data: { lastPingedAt: new Date() },
  });

  logActivity("group_pinged", session.userId, {
    groupId,
    recipientCount: recipients.length,
    hasCustomMessage: Boolean(customMessage),
  });

  const nextAvailableAt = new Date(Date.now() + PING_COOLDOWN_MS);
  return NextResponse.json({
    success: true,
    recipientCount: recipients.length,
    nextAvailableAt: nextAvailableAt.toISOString(),
  });
}
