import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replyEditSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";

type Params = { params: Promise<{ id: string; replyId: string }> };

async function requireLiveReply(threadId: string, replyId: string) {
  const reply = await prisma.communityReply.findFirst({
    where: { id: replyId, threadId, deletedAt: null, thread: { deletedAt: null } },
    select: { id: true, authorId: true },
  });
  if (!reply) throw new ApiError(404, "Respuesta no encontrada");
  return reply;
}

// Edita una respuesta propia.
export const PATCH = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id, replyId } = await params;
  const reply = await requireLiveReply(id, replyId);
  if (reply.authorId !== session.userId) {
    throw new ApiError(403, "No puedes editar esta respuesta");
  }

  const { body } = await parseBody(request, replyEditSchema);

  const updated = await prisma.communityReply.update({
    where: { id: replyId },
    data: { body, editedAt: new Date() },
    select: { id: true, body: true, editedAt: true },
  });

  return NextResponse.json({ reply: updated });
});

// Borra una respuesta (deja su hueco). Su autor o un superadmin.
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id, replyId } = await params;
  const reply = await requireLiveReply(id, replyId);
  if (reply.authorId !== session.userId && !(await isSuperadmin(session))) {
    throw new ApiError(403, "No puedes borrar esta respuesta");
  }

  await prisma.communityReply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});
