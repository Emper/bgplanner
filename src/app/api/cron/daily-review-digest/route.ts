import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TZ = "Europe/Madrid";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

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

  const playedGames = await prisma.groupGame.findMany({
    where: { playedAt: { gte: yesterdayStart, lt: todayStart } },
    select: {
      gameId: true,
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

  return NextResponse.json({
    ok: true,
    window: { from: yesterdayStart.toISOString(), to: todayStart.toISOString() },
    gamesPlayed: playedGames.length,
    emailsSent,
  });
}
