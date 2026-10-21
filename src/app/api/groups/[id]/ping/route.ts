import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { EMAIL_COLORS as C, emailBox, emailButton, html, sendAppEmailLater } from "@/lib/email";
import { isGroupManager } from "@/lib/groupTypes";
import { pingSchema } from "@/lib/validations";
import { computeRanking } from "@/lib/ranking";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { absoluteUrl } from "@/lib/site";
import { displayName } from "@/lib/users";

const PING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MEDALS = ["🥇", "🥈", "🥉"];

function cooldownError(lastPingedAt: Date) {
  return new ApiError(429, "Solo puedes convocar una vez por semana", {
    nextAvailableAt: new Date(lastPingedAt.getTime() + PING_COOLDOWN_MS).toISOString(),
  });
}

// Convocatoria: email y aviso en la campana a todo el grupo para que vote.
// Con `resetVotes` (solo admins) además pone el ranking a cero.
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;

    const membership = await requireGroupMember(groupId, session.userId);
    const parsed = await parseBody(request, pingSchema);
    const customMessage = parsed.message?.trim() || "";
    const resetVotes = parsed.resetVotes === true;

    // Reiniciar las votaciones borra datos de todo el grupo: solo admins.
    if (resetVotes && !isGroupManager(membership.role)) {
      throw new ApiError(403, "Solo los admins del grupo pueden reiniciar las votaciones");
    }

    if (
      membership.lastPingedAt &&
      Date.now() - membership.lastPingedAt.getTime() < PING_COOLDOWN_MS
    ) {
      throw cooldownError(membership.lastPingedAt);
    }

    const [group, sender, ranking] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            where: { userId: { not: session.userId } },
            // El email solo sirve para mandar la convocatoria: no sale de aquí.
            include: { user: { select: { id: true, email: true } } },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, displayName: true },
      }),
      computeRanking(groupId, undefined, { pendingOnly: true }),
    ]);

    if (!group || !sender) throw new ApiError(404, "Grupo no encontrado");

    // Se reserva la convocatoria de forma atómica: con dos peticiones a la
    // vez solo pasa una (la otra ve el lastPingedAt recién puesto).
    const now = new Date();
    const claimed = await prisma.groupMember.updateMany({
      where: {
        groupId,
        userId: session.userId,
        OR: [
          { lastPingedAt: null },
          { lastPingedAt: { lt: new Date(now.getTime() - PING_COOLDOWN_MS) } },
        ],
      },
      data: { lastPingedAt: now },
    });
    if (claimed.count === 0) throw cooldownError(now);

    const senderName = displayName(sender, "Un miembro");
    const top3 = ranking.slice(0, 3);

    // "Foto" del ranking previo al borrado. Se guarda en el activity log, así
    // que aunque los votos desaparezcan queda el registro de cómo iba la cosa.
    const snapshot = resetVotes
      ? ranking
          .slice(0, 10)
          .filter((g) => g.score !== 0)
          .map((g) => ({ name: g.game.name, score: g.score }))
      : [];

    let votesDeleted = 0;
    if (resetVotes) {
      // Solo se borran los votos: los juegos del ranking (GroupGame) y sus
      // comentarios se quedan tal cual.
      const deleted = await prisma.vote.deleteMany({
        where: { groupGame: { groupId } },
      });
      votesDeleted = deleted.count;
    }

    // Usamos <table> en vez de flex: Gmail/Outlook no soportan flex de forma
    // fiable y sin esto los puntos quedan pegados al nombre del juego.
    const top3Html = top3.length
      ? emailBox(html`
          <p style="margin: 0 0 14px; color: ${C.muted}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">${resetVotes ? "Así quedó antes del reinicio" : "Así va el ranking"}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
            ${top3.map((g, i) => {
              const borderStyle = i < top3.length - 1 ? `border-bottom: 1px solid ${C.border};` : "";
              return html`
              <tr>
                <td style="padding: 10px 0; color: ${C.text}; font-size: 15px; ${borderStyle}">
                  ${MEDALS[i]}&nbsp;&nbsp;${g.game.name}
                </td>
                <td align="right" style="padding: 10px 0 10px 16px; color: ${C.accent}; font-weight: bold; font-size: 15px; white-space: nowrap; ${borderStyle}">
                  ${g.score} pts
                </td>
              </tr>`;
            })}
          </table>`)
      : null;

    const customMessageHtml = customMessage
      ? html`<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid ${C.accent}; background: ${C.card}; color: #e2e8f0; font-style: italic; border-radius: 4px;">"${customMessage}"</blockquote>`
      : null;

    const introHtml = resetVotes
      ? html`
        <p style="margin: 0 0 16px; font-size: 18px;"><strong>Borrón y cuenta nueva</strong> 🧹</p>
        <p>
          <strong>${senderName}</strong> ha reiniciado las votaciones de
          <strong style="color: ${C.accent};">"${group.name}"</strong>.
          Los juegos siguen todos ahí, pero los votos se han puesto a cero: toca
          volver a decidir a qué queréis jugar.
        </p>`
      : html`
        <p style="margin: 0 0 16px; font-size: 18px;"><strong>¡Tirada a la vista!</strong> 🎲</p>
        <p>
          <strong>${senderName}</strong> quiere organizar la próxima partida de
          <strong style="color: ${C.accent};">"${group.name}"</strong>
          y necesita tu ayuda para decidir a qué jugar.
        </p>`;

    const ctaLine = resetVotes
      ? "Estrena el ranking: entra y vota tus favoritos 👇"
      : "Echa un vistazo, revisa tus preferencias y vota tus favoritos 👇";

    const subject = resetVotes
      ? `🧹 ${senderName} ha reiniciado el ranking de "${group.name}" — a votar de nuevo`
      : `🎲 ${senderName} quiere jugar — vota tus favoritos en "${group.name}"`;

    const body = html`
      ${introHtml}
      ${customMessageHtml}
      ${top3Html}
      <p>${ctaLine}</p>
      ${emailButton(absoluteUrl(`/groups/${groupId}`), "Votar en el ranking")}
      <p style="color: ${C.muted}; font-size: 14px; margin-top: 24px;">Nos vemos en la mesa 🎲<br/>— El equipo de BG Planner</p>
    `;

    // Un email por persona (que nadie vea las direcciones de los demás),
    // enviados después de responder.
    const recipients = group.members
      .map((m) => m.user.email)
      .filter((e): e is string => Boolean(e));
    for (const to of recipients) {
      sendAppEmailLater({ to, subject, body });
    }

    if (resetVotes) {
      logActivity("votes_reset", session.userId, {
        groupId,
        votesDeleted,
        topBefore: snapshot,
      });
    }

    // El email sigue saliendo (convocar es justo para avisar fuera de la web),
    // y además queda en la campana de cada uno.
    notify({
      type: "group_pinged",
      userIds: group.members.map((m) => m.userId),
      actorId: session.userId,
      groupId,
    });

    logActivity("group_pinged", session.userId, {
      groupId,
      recipientCount: recipients.length,
      hasCustomMessage: Boolean(customMessage),
      resetVotes,
    });

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      votesDeleted,
      nextAvailableAt: new Date(now.getTime() + PING_COOLDOWN_MS).toISOString(),
    });
  }
);
