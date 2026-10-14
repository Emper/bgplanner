import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replySchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string; replyId: string }> };

function findLiveReply(threadId: string, replyId: string) {
  return prisma.communityReply.findFirst({
    where: { id: replyId, threadId, deletedAt: null, thread: { deletedAt: null } },
    select: { id: true, authorId: true },
  });
}

// Edita una respuesta propia.
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, replyId } = await params;
  const reply = await findLiveReply(id, replyId);
  if (!reply) {
    return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
  }
  if (reply.authorId !== session.userId) {
    return NextResponse.json({ error: "No puedes editar esta respuesta" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.communityReply.update({
    where: { id: replyId },
    data: { body: parsed.data.body, editedAt: new Date() },
    select: { id: true, body: true, editedAt: true },
  });

  return NextResponse.json({ reply: updated });
}

// Borra una respuesta (deja su hueco). Su autor o un superadmin.
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, replyId } = await params;
  const reply = await findLiveReply(id, replyId);
  if (!reply) {
    return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
  }
  if (reply.authorId !== session.userId && !(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No puedes borrar esta respuesta" }, { status: 403 });
  }

  await prisma.communityReply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
