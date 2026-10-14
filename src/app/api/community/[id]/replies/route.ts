import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { replySchema } from "@/lib/validations";
import {
  AUTHOR_SELECT,
  countRecentReplies,
  findLiveThread,
  publicAuthor,
} from "@/lib/communityServer";

const MAX_REPLIES_PER_10_MIN = 15;

// Responde a un hilo y lo sube al principio del listado.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const thread = await findLiveThread(id);
  if (!thread) {
    return NextResponse.json({ error: "Este hilo no existe o lo han borrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if ((await countRecentReplies(session.userId, 10)) >= MAX_REPLIES_PER_10_MIN) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un poco antes de seguir respondiendo" },
      { status: 429 }
    );
  }

  const now = new Date();
  const [reply] = await prisma.$transaction([
    prisma.communityReply.create({
      data: { threadId: id, authorId: session.userId, body: parsed.data.body, createdAt: now },
      select: { id: true, body: true, createdAt: true, editedAt: true, author: { select: AUTHOR_SELECT } },
    }),
    prisma.communityThread.update({ where: { id }, data: { lastActivityAt: now } }),
  ]);

  logActivity("community_replied", session.userId, {
    threadId: id,
    threadTitle: thread.title,
    replyId: reply.id,
  });

  return NextResponse.json({
    reply: { ...reply, deleted: false, author: publicAuthor(reply.author) },
  });
}
