import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireSession } from "@/lib/api";
import { markThreadNotificationsRead } from "@/lib/communityServer";

type Params = { params: Promise<{ id: string }> };

// Quien abre un hilo da por vistos sus avisos de respuestas. Devuelve cuántos
// le quedan sin leer para que la campana se ponga al día al momento.
export const POST = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id } = await params;
  const unread = await markThreadNotificationsRead(session.userId, id);
  return NextResponse.json({ unread });
});
