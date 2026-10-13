import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyNow, NOTIFICATION_TTL_DAYS } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TZ = "Europe/Madrid";

interface MadridParts {
  y: number;
  mo: number; // 1-12
  d: number;
  h: number;
}

function madridParts(date: Date): MadridParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // "24" a medianoche en algunos runtimes → normalizar a 0.
  const h = get("hour") % 24;
  return { y: get("year"), mo: get("month"), d: get("day"), h };
}

// Instante UTC correspondiente a la medianoche local de Madrid de (y, mo, d).
function madridMidnightUTC(y: number, mo: number, d: number): Date {
  const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const p = madridParts(new Date(guess));
  const asIfUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, 0, 0);
  const offset = asIfUTC - guess; // ms que hay que restar para pasar de local a UTC
  return new Date(guess - offset);
}

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
      game: { select: { name: true, thumbnail: true } },
      reviews: { select: { userId: true } },
      group: {
        select: {
          id: true,
          name: true,
          members: { select: { userId: true } },
        },
      },
    },
  });

  const inWindow = (d: Date | null) => !!d && d >= yesterdayStart && d < todayStart;
  const playedGames = candidateGames.filter(
    (gg) => inWindow(gg.playedAt) || sessionPairs.has(`${gg.groupId}:${gg.gameId}`)
  );

  // Por usuario y grupo: qué juegos de ayer le faltan por valorar. Un aviso
  // por grupo, con todos sus juegos dentro.
  const pending = new Map<
    string,
    { userId: string; groupId: string; games: { id: string; name: string; thumbnail: string | null }[] }
  >();

  for (const gg of playedGames) {
    const reviewers = new Set(gg.reviews.map((r) => r.userId));
    for (const m of gg.group.members) {
      if (reviewers.has(m.userId)) continue; // ya opinó
      const key = `${m.userId}:${gg.group.id}`;
      const entry = pending.get(key) ?? { userId: m.userId, groupId: gg.group.id, games: [] };
      entry.games.push({ id: gg.gameId, name: gg.game.name, thumbnail: gg.game.thumbnail });
      pending.set(key, entry);
    }
  }

  let gameReminders = 0;
  for (const { userId, groupId, games } of pending.values()) {
    gameReminders += await notifyNow({
      type: "review_games",
      userIds: [userId],
      groupId,
      metadata: { games },
    }).catch(() => 0);
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
      reviews: { select: { userId: true } },
      attendees: {
        where: { status: { not: "cancelled" } },
        select: { userId: true },
      },
    },
  });

  let eventReminders = 0;
  for (const ev of endedEvents) {
    const reviewers = new Set(ev.reviews.map((r) => r.userId));
    // Creador + asistentes (no cancelados) que aún no han valorado.
    const userIds = [ev.createdById, ...ev.attendees.map((a) => a.userId)].filter(
      (id) => !reviewers.has(id)
    );
    eventReminders += await notifyNow({ type: "review_event", userIds, eventId: ev.id }).catch(() => 0);
  }

  // Limpieza: las notificaciones viejas ya no le sirven a nadie.
  const purged = await prisma.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_TTL_DAYS * 86_400_000) } },
  });

  return NextResponse.json({
    ok: true,
    window: { from: yesterdayStart.toISOString(), to: todayStart.toISOString() },
    gamesPlayed: playedGames.length,
    gameReminders,
    eventsEnded: endedEvents.length,
    eventReminders,
    notificationsPurged: purged.count,
  });
}
