import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { inBackground } from "@/lib/background";
import { notify, notifyNow } from "@/lib/notifications";
import { replySchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import {
  AUTHOR_SELECT,
  QUOTED_REPLY_SELECT,
  countRecentReplies,
  findLiveThread,
  publicAuthor,
  toReplyQuote,
} from "@/lib/communityServer";

const MAX_REPLIES_PER_10_MIN = 15;

type Params = { params: Promise<{ id: string }> };

// Responde a un hilo y lo sube al principio del listado.
export const POST = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);

  const { id } = await params;
  const thread = await findLiveThread(id);
  if (!thread) throw new ApiError(404, "Este hilo no existe o lo han borrado");

  const data = await parseBody(request, replySchema);

  if ((await countRecentReplies(session.userId, 10)) >= MAX_REPLIES_PER_10_MIN) {
    throw new ApiError(429, "Vas muy rápido. Espera un poco antes de seguir respondiendo");
  }

  // Solo se cita una respuesta viva de este mismo hilo.
  const { quotedReplyId } = data;
  const quoted = quotedReplyId
    ? await prisma.communityReply.findFirst({
        where: { id: quotedReplyId, threadId: id, deletedAt: null },
        select: { id: true, authorId: true },
      })
    : null;
  if (quotedReplyId && !quoted) {
    throw new ApiError(400, "El mensaje que citas ya no está. Quita la cita y vuelve a intentarlo");
  }

  const now = new Date();
  const [reply] = await prisma.$transaction([
    prisma.communityReply.create({
      data: {
        threadId: id,
        authorId: session.userId,
        body: data.body,
        quotedReplyId: quoted?.id ?? null,
        createdAt: now,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: { select: AUTHOR_SELECT },
        quotedReply: { select: QUOTED_REPLY_SELECT },
      },
    }),
    prisma.communityThread.update({ where: { id }, data: { lastActivityAt: now } }),
  ]);

  logActivity("community_replied", session.userId, {
    threadId: id,
    threadTitle: thread.title,
    replyId: reply.id,
  });

  notifyThreadReply({
    threadId: id,
    threadTitle: thread.title,
    threadAuthorId: thread.authorId,
    replyId: reply.id,
    actorId: session.userId,
    quotedAuthorId: quoted?.authorId ?? null,
  });

  const { quotedReply, ...rest } = reply;
  return NextResponse.json({
    reply: {
      ...rest,
      deleted: false,
      author: publicAuthor(reply.author),
      likes: 0,
      quote: toReplyQuote(quotedReply),
    },
  });
});

// Avisa a quien cita, al autor del hilo y a quienes ya habían respondido en él
// (cada uno con su texto y una sola vez: a quien citas le llega «te ha citado»
// y no además «ha respondido»). Todo después de responder: nunca retrasa ni
// hace fallar la respuesta.
function notifyThreadReply(opts: {
  threadId: string;
  threadTitle: string;
  threadAuthorId: string;
  replyId: string;
  actorId: string;
  quotedAuthorId: string | null;
}) {
  const metadata = { threadId: opts.threadId, threadTitle: opts.threadTitle, replyId: opts.replyId };
  const quoted = opts.quotedAuthorId;

  if (quoted) {
    notify({ type: "community_quoted", userIds: [quoted], actorId: opts.actorId, metadata });
  }

  if (opts.threadAuthorId !== quoted) {
    notify({
      type: "community_reply",
      userIds: [opts.threadAuthorId],
      actorId: opts.actorId,
      metadata,
    });
  }

  inBackground(async () => {
    const rows = await prisma.communityReply.findMany({
      where: { threadId: opts.threadId, deletedAt: null },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    await notifyNow({
      type: "community_participant_reply",
      userIds: rows
        .map((r) => r.authorId)
        .filter((uid) => uid !== opts.threadAuthorId && uid !== quoted),
      actorId: opts.actorId,
      metadata,
    });
  });
}
