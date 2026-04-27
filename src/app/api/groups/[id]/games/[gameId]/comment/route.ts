import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { gameCommentSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
    include: { game: { select: { name: true } } },
  });
  if (!groupGame) {
    return NextResponse.json(
      { error: "Juego no encontrado en este grupo" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = gameCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const text = parsed.data.text;

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
    update: { text },
  });

  // Solo loguear la primera vez que se crea (no en ediciones).
  if (!existingComment) {
    logActivity("vote_commented", session.userId, {
      groupId,
      gameName: groupGame.game.name,
      comment: text.slice(0, 80),
    });
  }

  return NextResponse.json({
    ok: true,
    comment: { text: comment.text, updatedAt: comment.updatedAt },
  });
}
