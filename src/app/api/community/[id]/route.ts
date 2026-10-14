import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { threadUpdateSchema } from "@/lib/validations";
import { AUTHOR_SELECT, findLiveThread, publicAuthor } from "@/lib/communityServer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Tope de respuestas que se devuelven de una vez. Holgado para un foro de
// este tamaño; si algún hilo lo roza, toca paginar.
const MAX_REPLIES = 500;

// Hilo completo con sus respuestas, en orden cronológico. Se lee sin cuenta.
// Las respuestas borradas se devuelven sin texto ni autor para que quede su
// hueco en la conversación.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(request);

  const [thread, isAdmin] = await Promise.all([
    prisma.communityThread.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        body: true,
        tag: true,
        pinned: true,
        createdAt: true,
        editedAt: true,
        author: { select: AUTHOR_SELECT },
        replies: {
          orderBy: { createdAt: "asc" },
          take: MAX_REPLIES,
          select: {
            id: true,
            body: true,
            createdAt: true,
            editedAt: true,
            deletedAt: true,
            author: { select: AUTHOR_SELECT },
          },
        },
      },
    }),
    isSuperadmin(session),
  ]);

  if (!thread) {
    return NextResponse.json({ error: "Este hilo no existe o lo han borrado" }, { status: 404 });
  }

  const viewerId = session?.userId ?? null;

  return NextResponse.json(
    {
      isLoggedIn: !!session,
      isAdmin,
      viewerId,
      thread: {
        id: thread.id,
        title: thread.title,
        body: thread.body,
        tag: thread.tag,
        pinned: thread.pinned,
        createdAt: thread.createdAt,
        editedAt: thread.editedAt,
        author: publicAuthor(thread.author),
      },
      replies: thread.replies.map((r) =>
        r.deletedAt
          ? { id: r.id, deleted: true as const, createdAt: r.createdAt }
          : {
              id: r.id,
              deleted: false as const,
              body: r.body,
              createdAt: r.createdAt,
              editedAt: r.editedAt,
              author: publicAuthor(r.author),
            }
      ),
    },
    NO_STORE
  );
}

// Edita un hilo. El autor cambia título, texto y etiqueta; fijarlo arriba es
// cosa del superadmin, que también puede corregir la etiqueta.
export async function PATCH(
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
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = threadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const isAuthor = thread.authorId === session.userId;
  const admin = await isSuperadmin(session);
  const { title, body: text, tag, pinned } = parsed.data;

  if (pinned !== undefined && !admin) {
    return NextResponse.json({ error: "Solo un admin puede fijar hilos" }, { status: 403 });
  }
  const editsContent = title !== undefined || text !== undefined;
  if ((editsContent && !isAuthor) || (tag !== undefined && !isAuthor && !admin)) {
    return NextResponse.json({ error: "No puedes editar este hilo" }, { status: 403 });
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
}

// Borra un hilo (lo oculta). Puede hacerlo su autor o un superadmin.
export async function DELETE(
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
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }
  if (thread.authorId !== session.userId && !(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No puedes borrar este hilo" }, { status: 403 });
  }

  await prisma.communityThread.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
