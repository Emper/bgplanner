import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { ApiError, apiHandler, requireSession } from "@/lib/api";

type Params = { params: Promise<{ id: string; replyId: string }> };

async function likeState(replyId: string, liked: boolean) {
  const likes = await prisma.communityReplyLike.count({ where: { replyId } });
  return NextResponse.json({ likes, liked });
}

// Da «me gusta» a una respuesta. Idempotente: dos veces no suman. A las
// propias no se puede.
export const POST = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id, replyId } = await params;

  const reply = await prisma.communityReply.findFirst({
    where: { id: replyId, threadId: id, deletedAt: null, thread: { deletedAt: null } },
    select: { id: true, authorId: true, thread: { select: { title: true } } },
  });
  if (!reply) throw new ApiError(404, "Respuesta no encontrada");
  if (reply.authorId === session.userId) {
    throw new ApiError(400, "No puedes darte «me gusta» a ti mismo");
  }

  const existing = await prisma.communityReplyLike.findUnique({
    where: { replyId_userId: { replyId, userId: session.userId } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.communityReplyLike
      .create({ data: { replyId, userId: session.userId } })
      .catch(() => null); // doble clic en paralelo: ya existe y vale igual

    // Solo el primero avisa: quitarlo y volver a darlo no repite el aviso
    // mientras siga sin leer (se funden por respuesta).
    notify({
      type: "community_reply_liked",
      userIds: [reply.authorId],
      actorId: session.userId,
      metadata: { threadId: id, threadTitle: reply.thread.title, replyId },
    });
  }

  return likeState(replyId, true);
});

// Lo quita.
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { replyId } = await params;
  await prisma.communityReplyLike.deleteMany({ where: { replyId, userId: session.userId } });
  return likeState(replyId, false);
});
