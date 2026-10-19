import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gameManualSchema } from "@/lib/validations";
import { checkManualUrl } from "@/lib/bggLinks";
import { logActivity } from "@/lib/activity";

// El enlace al manual es del juego (sirve en todos los grupos y eventos).
// Lo pone cualquiera si no hay; cambiarlo o quitarlo, quien lo puso o un
// superadmin. Si está mal, se denuncia ("game_manual").
async function canEdit(
  game: { manualUrl: string | null; manualAddedById: string | null },
  session: { userId: string; email: string }
) {
  if (!game.manualUrl || game.manualAddedById === session.userId) return true;
  return isSuperadmin(session);
}

const manualSelect = { manualUrl: true, manualAddedById: true, manualAddedAt: true } as const;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, name: true, ...manualSelect } });
  if (!game) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }
  if (!(await canEdit(game, session))) {
    return NextResponse.json({ error: "Este juego ya tiene manual. Si está mal, denúncialo desde su menú." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = gameManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const check = checkManualUrl(parsed.data.url);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const manualUrl = check.url;

  const updated = await prisma.game.update({
    where: { id },
    data: { manualUrl, manualAddedById: session.userId, manualAddedAt: new Date() },
    select: manualSelect,
  });

  logActivity("game_manual_added", session.userId, { gameName: game.name, manualUrl });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, ...manualSelect } });
  if (!game) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }
  if (!game.manualUrl) {
    return NextResponse.json({ deleted: true });
  }
  if (!(await canEdit(game, session))) {
    return NextResponse.json({ error: "Solo quien puso el enlace puede quitarlo" }, { status: 403 });
  }

  await prisma.game.update({
    where: { id },
    data: { manualUrl: null, manualAddedById: null, manualAddedAt: null },
  });

  return NextResponse.json({ deleted: true });
}
