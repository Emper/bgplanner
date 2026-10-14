import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { threadUpdateSchema } from "@/lib/validations";
import { findLiveThread, getThreadDetail } from "@/lib/communityServer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Hilo completo con sus respuestas. Se lee sin cuenta (ver getThreadDetail).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(request);
  const [detail, isAdmin] = await Promise.all([getThreadDetail(id), isSuperadmin(session)]);

  if (!detail) {
    return NextResponse.json({ error: "Este hilo no existe o lo han borrado" }, { status: 404 });
  }

  return NextResponse.json(
    { isLoggedIn: !!session, isAdmin, viewerId: session?.userId ?? null, ...detail },
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
