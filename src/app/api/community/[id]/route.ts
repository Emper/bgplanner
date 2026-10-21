import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { threadUpdateSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { findLiveThread, getThreadDetail } from "@/lib/communityServer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Params = { params: Promise<{ id: string }> };

// Hilo completo con sus respuestas. Se lee sin cuenta (ver getThreadDetail).
export const GET = apiHandler(async (request: NextRequest, { params }: Params) => {
  const { id } = await params;
  const session = await getSession(request);
  const [detail, isAdmin] = await Promise.all([getThreadDetail(id), isSuperadmin(session)]);

  if (!detail) throw new ApiError(404, "Este hilo no existe o lo han borrado");

  return NextResponse.json(
    { isLoggedIn: !!session, isAdmin, viewerId: session?.userId ?? null, ...detail },
    NO_STORE
  );
});

async function requireLiveThread(id: string) {
  const thread = await findLiveThread(id);
  if (!thread) throw new ApiError(404, "Hilo no encontrado");
  return thread;
}

// Edita un hilo. El autor cambia título, texto y etiqueta; fijarlo arriba es
// cosa del superadmin, que también puede corregir la etiqueta.
export const PATCH = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id } = await params;
  const thread = await requireLiveThread(id);
  const { title, body: text, tag, pinned } = await parseBody(request, threadUpdateSchema);

  const isAuthor = thread.authorId === session.userId;
  const admin = await isSuperadmin(session);

  if (pinned !== undefined && !admin) {
    throw new ApiError(403, "Solo un admin puede fijar hilos");
  }
  const editsContent = title !== undefined || text !== undefined;
  if ((editsContent && !isAuthor) || (tag !== undefined && !isAuthor && !admin)) {
    throw new ApiError(403, "No puedes editar este hilo");
  }

  const updated = await prisma.communityThread.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(text !== undefined ? { body: text } : {}),
      ...(tag !== undefined ? { tag } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
      ...(editsContent ? { editedAt: new Date() } : {}),
    },
    select: { id: true, title: true, body: true, tag: true, pinned: true, editedAt: true },
  });

  return NextResponse.json({ thread: updated });
});

// Borra un hilo (lo oculta). Puede hacerlo su autor o un superadmin.
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id } = await params;
  const thread = await requireLiveThread(id);
  if (thread.authorId !== session.userId && !(await isSuperadmin(session))) {
    throw new ApiError(403, "No puedes borrar este hilo");
  }

  await prisma.communityThread.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
});
