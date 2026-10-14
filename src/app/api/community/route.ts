import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { threadCreateSchema } from "@/lib/validations";
import { THREADS_PAGE_SIZE, isCommunityTag } from "@/lib/community";
import { countRecentThreads, getLatestThreads, listThreads } from "@/lib/communityServer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const MAX_THREADS_PER_HOUR = 5;

// Listado del foro. Se lee sin cuenta (ver listThreads).
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  const params = request.nextUrl.searchParams;

  // ?limit=N: solo los N hilos con movimiento más reciente, para el inicio.
  const limitParam = Number(params.get("limit"));
  if (Number.isInteger(limitParam) && limitParam > 0) {
    const threads = await getLatestThreads(Math.min(limitParam, THREADS_PAGE_SIZE));
    return NextResponse.json({ isLoggedIn: !!session, threads }, NO_STORE);
  }

  const tagParam = params.get("tag");
  const [list, isAdmin] = await Promise.all([
    listThreads({
      tag: isCommunityTag(tagParam) ? tagParam : null,
      q: params.get("q"),
      cursor: params.get("cursor"),
    }),
    isSuperadmin(session),
  ]);

  return NextResponse.json({ isLoggedIn: !!session, isAdmin, ...list }, NO_STORE);
}

// Abre un hilo nuevo.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = threadCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if ((await countRecentThreads(session.userId, 60)) >= MAX_THREADS_PER_HOUR) {
    return NextResponse.json(
      { error: "Has abierto muchos hilos seguidos. Prueba de nuevo en un rato" },
      { status: 429 }
    );
  }

  const { title, body: text, tag } = parsed.data;
  const thread = await prisma.communityThread.create({
    data: { authorId: session.userId, title, body: text, tag },
    select: { id: true },
  });

  logActivity("community_thread_created", session.userId, {
    threadId: thread.id,
    threadTitle: title,
    tag,
  });

  return NextResponse.json({ id: thread.id });
}
