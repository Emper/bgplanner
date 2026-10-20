import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

type Params = { params: Promise<{ id: string; replyId: string }> };

function findLikeableReply(threadId: string, replyId: string) {
  return prisma.communityReply.findFirst({
    where: { id: replyId, threadId, deletedAt: null, thread: { deletedAt: null } },
    select: { id: true, authorId: true, thread: { select: { title: true } } },
  });
}

async function likeState(replyId: string, liked: boolean) {
  const likes = await prisma.communityReplyLike.count({ where: { replyId } });
  return NextResponse.json({ likes, liked });
}

// Da «me gusta» a una respuesta. Idempotente: dos veces no suman. A las
// propias no se puede.
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, replyId } = await params;
  const reply = await findLikeableReply(id, replyId);
  if (!reply) {
    return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
  }
  if (reply.authorId === session.userId) {
    return NextResponse.json({ error: "No puedes darte «me gusta» a ti mismo" }, { status: 400 });
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
}

// Lo quita.
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { replyId } = await params;
  await prisma.communityReplyLike.deleteMany({ where: { replyId, userId: session.userId } });
  return likeState(replyId, false);
}
