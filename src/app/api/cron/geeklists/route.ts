import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GEEKLIST_REFRESH_MS, syncEventGeeklist } from "@/lib/geeklist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240 * 1000;

// Red de seguridad, una vez al día: reimporta las listas de BGG de los
// eventos que aún no han pasado, aunque nadie los haya abierto. Lo normal es
// que se actualicen antes, al abrir el evento (ver lib/geeklist.ts).
export async function GET(request: NextRequest) {
  // Protección: Vercel Cron manda Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      bggGeeklistId: { not: null },
      OR: [{ endDate: { gte: since } }, { endDate: null, date: { gte: since } }],
    },
    select: { id: true },
    orderBy: { geeklistCheckedAt: { sort: "asc", nulls: "first" } },
  });

  let synced = 0;
  let skipped = 0;
  let failures = 0;
  for (const event of events) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    try {
      const result = await syncEventGeeklist(event.id, { minGapMs: GEEKLIST_REFRESH_MS });
      if (result) synced++;
      else skipped++;
    } catch (err) {
      console.error(`[Cron geeklists] ${event.id}:`, err);
      failures++;
    }
  }

  return NextResponse.json({ events: events.length, synced, skipped, failures });
}
