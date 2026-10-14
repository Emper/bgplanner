import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markThreadNotificationsRead } from "@/lib/communityServer";

// Quien abre un hilo da por vistos sus avisos de respuestas. Devuelve cuántos
// le quedan sin leer para que la campana se ponga al día al momento.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const unread = await markThreadNotificationsRead(session.userId, id);
  return NextResponse.json({ unread });
}
