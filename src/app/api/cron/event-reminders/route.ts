import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyEventReminder } from "@/lib/notificationEmitters";
import { madridParts, madridMidnightUTC } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hora de Madrid a la que se manda el recordatorio. */
const SEND_HOUR = 10;

/**
 * Recordatorio de los eventos de mañana.
 *
 * Sale a las 10:00 de la mañana hora de Madrid, un día antes. El cron se
 * programa a las 08:00 y 09:00 UTC para cubrir horario de verano e invierno, y
 * este guardia deja pasar solo la ejecución que cae a las 10:00 locales, de
 * modo que se envía una vez al día. Es el mismo patrón que
 * `daily-review-digest`, y evita tener que marcar en la base de datos qué
 * eventos ya se han recordado.
 *
 * `?force=1` salta el guardia horario, para poder probarlo a mano.
 */
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

  const nowParts = madridParts(now);
  if (!force && nowParts.h !== SEND_HOUR) {
    return NextResponse.json({ skipped: "fuera de hora", hour: nowParts.h });
  }

  // Ventana: todo el día de mañana en hora local.
  const todayMidnight = madridMidnightUTC(nowParts.y, nowParts.mo, nowParts.d);
  const from = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
  const to = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: { date: { gte: from, lt: to } },
    select: { id: true, name: true, date: true, location: true },
    orderBy: { date: "asc" },
  });

  let push = 0;
  let email = 0;
  for (const event of events) {
    const result = await notifyEventReminder({
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      location: event.location,
    });
    push += result.push;
    email += result.email;
  }

  return NextResponse.json({ events: events.length, push, email });
}
