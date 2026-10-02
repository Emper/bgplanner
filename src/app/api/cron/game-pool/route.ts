import { NextRequest, NextResponse } from "next/server";
import {
  ENRICH_BATCH,
  hotMissingIds,
  poolMissingIds,
  saveGameInfo,
  staleInfoIds,
} from "@/lib/recommendations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Cuánto trabajamos por pasada, con margen hasta el límite de la función.
// Cada lote es una llamada a BGG (20 juegos) con su espera de cortesía.
const TIME_BUDGET_MS = 240 * 1000;

// Amplía y refresca, una vez al día, el pool de juegos entre los que se
// eligen las recomendaciones: primero los más comentados de BGG, luego los
// que aparecen en las colecciones de la comunidad y, si sobra tiempo, las
// fichas más antiguas.
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
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;
  let added = 0;
  let refreshed = 0;
  let failures = 0;

  const run = async (ids: number[]): Promise<boolean> => {
    try {
      await saveGameInfo(ids);
      return true;
    } catch (err) {
      console.error("[Cron pool] Lote fallido:", err);
      failures++;
      return false;
    }
  };

  try {
    const hot = await hotMissingIds();
    for (let i = 0; i < hot.length && !outOfTime(); i += ENRICH_BATCH) {
      const batch = hot.slice(i, i + ENRICH_BATCH);
      if (await run(batch)) added += batch.length;
    }
  } catch (err) {
    console.error("[Cron pool] Sin lista de BGG:", err);
  }

  const missing = await poolMissingIds(5000);
  for (let i = 0; i < missing.length && !outOfTime() && failures < 3; i += ENRICH_BATCH) {
    const batch = missing.slice(i, i + ENRICH_BATCH);
    if (await run(batch)) added += batch.length;
  }

  while (!outOfTime() && failures < 3) {
    const stale = await staleInfoIds();
    if (stale.length === 0) break;
    if (await run(stale)) refreshed += stale.length;
  }

  return NextResponse.json({
    added,
    refreshed,
    failures,
    remaining: Math.max(0, missing.length - added),
    seconds: Math.round((Date.now() - startedAt) / 1000),
  });
}
