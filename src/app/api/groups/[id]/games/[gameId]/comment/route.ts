import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { gameCommentSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { truncateChars } from "@/lib/text";

// La nota de cada uno sobre un juego del ranking. Texto vacío = borrarla.
export const PUT = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;

  const [, groupGame] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: { game: { select: { name: true } } },
    }),
  ]);
  if (!groupGame) throw new ApiError(404, "Juego no encontrado en este grupo");

  const { text } = await parseBody(request, gameCommentSchema);

  const existingComment = await prisma.gameComment.findUnique({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
  });

  if (text === "") {
    if (existingComment) {
      await prisma.gameComment.delete({ where: { id: existingComment.id } });
    }
    return NextResponse.json({ ok: true, comment: null });
  }

  const comment = await prisma.gameComment.upsert({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
    create: {
      groupGameId: groupGame.id,
      userId: session.userId,
      text,
    },
    // Si la nota estaba soft-borrada (p.ej. tras marcar jugado), reactivarla.
    update: { text, deletedAt: null },
  });

  // Solo loguear si no había una nota activa previa. Así si borra y vuelve a
  // comentar (o si estaba soft-borrada) no spammeamos el feed de más.
  const hadActiveComment = existingComment && existingComment.deletedAt === null;
  if (!hadActiveComment) {
    const previousLog = await prisma.activityLog.findFirst({
      where: {
        type: "vote_commented",
        userId: session.userId,
        groupId,
        metadata: { path: ["gameName"], equals: groupGame.game.name },
      },
      select: { id: true },
    });
    if (!previousLog) {
      logActivity("vote_commented", session.userId, {
        groupId,
        gameName: groupGame.game.name,
        comment: truncateChars(text, 80),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    comment: { text: comment.text, updatedAt: comment.updatedAt },
  });
});
