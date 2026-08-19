import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";
import { madridParts, madridMidnightUTC } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export async function GET(request: NextRequest) {
  // Protección: Vercel Cron manda Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const now = new Date();
  const force = request.nextUrl.searchParams.get("force") === "1";

  // Solo se envía a las 14:00 hora de Madrid. El cron se programa a las 12:00 y
  // 13:00 UTC para cubrir verano e invierno; este guardia deja pasar solo la
  // ejecución que cae a las 14:00 locales (una al día). `force=1` lo salta.
  const nowParts = madridParts(now);
  if (!force && nowParts.h !== 14) {
    return NextResponse.json({ skipped: true, reason: `hora Madrid ${nowParts.h}h != 14h` });
  }

  // Ventana = día de AYER en Madrid.
  const todayStart = madridMidnightUTC(nowParts.y, nowParts.mo, nowParts.d);
  const yestUTC = new Date(todayStart.getTime() - 12 * 60 * 60 * 1000); // mediodía de ayer, seguro dentro de ayer
  const yp = madridParts(yestUTC);
  const yesterdayStart = madridMidnightUTC(yp.y, yp.mo, yp.d);

  // Fuentes de "jugado ayer":
  //  1) GroupGame.playedAt dentro de la ventana (marcar como jugado).
  //  2) Juegos completados en sesiones cuya fecha cae en ayer.
  // Recolectamos primero los pares (grupo, juego) de las sesiones de ayer.
  const yestSessions = await prisma.gameSession.findMany({
    where: { date: { gte: yesterdayStart, lt: todayStart } },
    select: {
      groupId: true,
      games: { where: { status: "completed" }, select: { gameId: true } },
    },
  });
  const sessionPairs = new Set<string>(); // `${groupId}:${gameId}`
  const sessionGroupIds = new Set<string>();
  const sessionGameIds = new Set<string>();
  for (const s of yestSessions) {
    for (const sg of s.games) {
      sessionPairs.add(`${s.groupId}:${sg.gameId}`);
      sessionGroupIds.add(s.groupId);
      sessionGameIds.add(sg.gameId);
    }
  }

  // GroupGames que califican por cualquiera de las dos vías. El segundo OR es
  // un superconjunto (grupos × juegos de las sesiones) que afinamos luego a los
  // pares exactos, porque Prisma no puede correlacionar groupId+gameId en un IN.
  const candidateGames = await prisma.groupGame.findMany({
    where: {
      OR: [
        { playedAt: { gte: yesterdayStart, lt: todayStart } },
        sessionPairs.size > 0
          ? {
              groupId: { in: Array.from(sessionGroupIds) },
              gameId: { in: Array.from(sessionGameIds) },
            }
          : { id: "__no-match__" },
      ],
    },
    select: {
      gameId: true,
      groupId: true,
      playedAt: true,
      game: { select: { name: true } },
      reviews: { select: { userId: true } },
      group: {
        select: {
          id: true,
          name: true,
          members: {
            select: {
              userId: true,
              user: { select: { email: true, name: true, displayName: true } },
            },
          },
        },
      },
    },
  });

  const inWindow = (d: Date | null) => !!d && d >= yesterdayStart && d < todayStart;
  const playedGames = candidateGames.filter(
    (gg) => inWindow(gg.playedAt) || sessionPairs.has(`${gg.groupId}:${gg.gameId}`)
  );

  // Por usuario: qué juegos de ayer le faltan por valorar (agrupados por grupo).
  interface Item {
    groupId: string;
    groupName: string;
    gameId: string;
    gameName: string;
  }
  const perUser = new Map<
    string,
    { email: string; name: string; items: Item[] }
  >();

  for (const gg of playedGames) {
    const reviewers = new Set(gg.reviews.map((r) => r.userId));
    for (const m of gg.group.members) {
      if (reviewers.has(m.userId)) continue; // ya opinó
      if (!m.user.email) continue;
      const entry =
        perUser.get(m.userId) ??
        {
          email: m.user.email,
          name: m.user.displayName || m.user.name || "jugador",
          items: [] as Item[],
        };
      entry.items.push({
        groupId: gg.group.id,
        groupName: gg.group.name,
        gameId: gg.gameId,
        gameName: gg.game.name,
      });
      perUser.set(m.userId, entry);
    }
  }

  let emailsSent = 0;
  for (const { email, name, items } of perUser.values()) {
    // Agrupar los juegos por grupo para el cuerpo del email.
    const byGroup = new Map<string, { name: string; games: Item[] }>();
    for (const it of items) {
      const g = byGroup.get(it.groupId) ?? { name: it.groupName, games: [] };
      g.games.push(it);
      byGroup.set(it.groupId, g);
    }

    const blocks = Array.from(byGroup.entries())
      .map(([groupId, g]) => {
        const rows = g.games
          .map((it) => {
            const url = `${APP_URL}/groups/${groupId}?review=${it.gameId}`;
            return `
              <tr>
                <td style="padding: 8px 0; color: #f1f5f9;">🎲 ${escapeHtml(it.gameName)}</td>
                <td style="padding: 8px 0; text-align: right;">
                  <a href="${url}" style="color: #f59e0b; text-decoration: none; font-weight: bold;">Valorar →</a>
                </td>
              </tr>`;
          })
          .join("");
        return `
          <p style="color: #94a3b8; font-size: 13px; margin: 18px 0 4px;">${escapeHtml(g.name)}</p>
          <table style="width: 100%; border-collapse: collapse;">${rows}</table>`;
      })
      .join("");

    resend.emails
      .send({
        from: "BG Planner <cesar@tiradacritica.es>",
        to: email,
        subject: "Valora los juegos de ayer 🎲",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
            <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner</h2>
            <p>¡Hola, ${escapeHtml(name)}! 🎲</p>
            <p>Estos juegos se marcaron como jugados ayer. ¿Qué te parecieron? Deja tu valoración, un comentario y las fotos de la partida.</p>
            ${blocks}
            <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">Si no jugaste alguna de estas partidas, ignora esa línea sin problema.</p>
          </div>
        `,
      })
      .catch(() => {}); // Nunca fallar por un email
    emailsSent += 1;
  }

  // ── Eventos terminados ayer: pedir valoración a los asistentes ──────────
  // "Terminado" = endDate en la ventana, o si no hay endDate, la fecha del evento.
  const endedEvents = await prisma.event.findMany({
    where: {
      OR: [
        { endDate: { gte: yesterdayStart, lt: todayStart } },
        { endDate: null, date: { gte: yesterdayStart, lt: todayStart } },
      ],
    },
    select: {
      id: true,
      name: true,
      createdById: true,
      createdBy: { select: { email: true, name: true, displayName: true } },
      reviews: { select: { userId: true } },
      attendees: {
        where: { status: { not: "cancelled" } },
        select: {
          userId: true,
          user: { select: { email: true, name: true, displayName: true } },
        },
      },
    },
  });

  let eventEmailsSent = 0;
  for (const ev of endedEvents) {
    const reviewers = new Set(ev.reviews.map((r) => r.userId));
    // Destinatarios: creador + asistentes (no cancelados) que aún no han valorado.
    const recipients = new Map<string, { email: string; name: string }>();
    if (ev.createdBy.email && !reviewers.has(ev.createdById)) {
      recipients.set(ev.createdById, {
        email: ev.createdBy.email,
        name: ev.createdBy.displayName || ev.createdBy.name || "organizador",
      });
    }
    for (const a of ev.attendees) {
      if (reviewers.has(a.userId) || !a.user.email) continue;
      recipients.set(a.userId, {
        email: a.user.email,
        name: a.user.displayName || a.user.name || "asistente",
      });
    }

    const eventNameSafe = escapeHtml(ev.name);
    const url = `${APP_URL}/events/${ev.id}?review=1`;
    for (const { email, name } of recipients.values()) {
      resend.emails
        .send({
          from: "BG Planner <cesar@tiradacritica.es>",
          to: email,
          subject: `¿Qué tal "${ev.name}"? Valora el evento 🎉`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
              <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner</h2>
              <p>¡Hola, ${escapeHtml(name)}! 🎉</p>
              <p>El evento <strong style="color: #f59e0b;">"${eventNameSafe}"</strong> ya ha terminado. ¿Qué tal fue?</p>
              <p>Deja tu valoración y súbele fotos a la galería del evento para que quede el recuerdo.</p>
              <a href="${url}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
                Valorar el evento
              </a>
            </div>
          `,
        })
        .catch(() => {}); // Nunca fallar por un email
      eventEmailsSent += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    window: { from: yesterdayStart.toISOString(), to: todayStart.toISOString() },
    gamesPlayed: playedGames.length,
    emailsSent,
    eventsEnded: endedEvents.length,
    eventEmailsSent,
  });
}
