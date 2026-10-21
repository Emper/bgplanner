import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gameManualSchema } from "@/lib/validations";
import { checkManualUrl } from "@/lib/bggLinks";
import { logActivity } from "@/lib/activity";
import { ApiError, apiHandler, parseBody, requireSession, type Session } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// El enlace al manual es del juego (sirve en todos los grupos y eventos).
// Lo pone cualquiera si no hay; cambiarlo o quitarlo, quien lo puso o un
// superadmin. Si está mal, se denuncia ("game_manual").
async function canEdit(
  game: { manualUrl: string | null; manualAddedById: string | null },
  session: Session
) {
  if (!game.manualUrl || game.manualAddedById === session.userId) return true;
  return isSuperadmin(session);
}

const manualSelect = { manualUrl: true, manualAddedById: true, manualAddedAt: true } as const;

export const PUT = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, name: true, ...manualSelect } });
  if (!game) throw new ApiError(404, "Juego no encontrado");
  if (!(await canEdit(game, session))) {
    throw new ApiError(403, "Este juego ya tiene manual. Si está mal, denúncialo desde su menú.");
  }

  const { url } = await parseBody(request, gameManualSchema);
  const check = checkManualUrl(url);
  if (!check.ok) throw new ApiError(400, check.error);
  const manualUrl = check.url;

  const updated = await prisma.game.update({
    where: { id },
    data: { manualUrl, manualAddedById: session.userId, manualAddedAt: new Date() },
    select: manualSelect,
  });

  logActivity("game_manual_added", session.userId, { gameName: game.name, manualUrl });

  return NextResponse.json(updated);
});

export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, ...manualSelect } });
  if (!game) throw new ApiError(404, "Juego no encontrado");
  if (!game.manualUrl) {
    return NextResponse.json({ deleted: true });
  }
  if (!(await canEdit(game, session))) {
    throw new ApiError(403, "Solo quien puso el enlace puede quitarlo");
  }

  await prisma.game.update({
    where: { id },
    data: { manualUrl: null, manualAddedById: null, manualAddedAt: null },
  });

  return NextResponse.json({ deleted: true });
});
