import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { threadCreateSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { THREADS_PAGE_SIZE, isCommunityTag } from "@/lib/community";
import { countRecentThreads, getLatestThreads, listThreads } from "@/lib/communityServer";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const MAX_THREADS_PER_HOUR = 5;

// Listado del foro. Se lee sin cuenta (ver listThreads).
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await getSession(request);
  const params = request.nextUrl.searchParams;

  // ?limit=N: solo los N hilos con movimiento más reciente, para el inicio.
  const limitParam = Number(params.get("limit"));
  if (Number.isInteger(limitParam) && limitParam > 0) {
    const threads = await getLatestThreads(Math.min(limitParam, THREADS_PAGE_SIZE), session?.userId);
    return NextResponse.json({ isLoggedIn: !!session, threads }, NO_STORE);
  }

  const tagParam = params.get("tag");
  const [list, isAdmin] = await Promise.all([
    listThreads({
      tag: isCommunityTag(tagParam) ? tagParam : null,
      q: params.get("q"),
      cursor: params.get("cursor"),
      viewerId: session?.userId,
    }),
    isSuperadmin(session),
  ]);

  return NextResponse.json({ isLoggedIn: !!session, isAdmin, ...list }, NO_STORE);
});

// Abre un hilo nuevo.
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { title, body: text, tag } = await parseBody(request, threadCreateSchema);

  if ((await countRecentThreads(session.userId, 60)) >= MAX_THREADS_PER_HOUR) {
    throw new ApiError(429, "Has abierto muchos hilos seguidos. Prueba de nuevo en un rato");
  }

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
});
