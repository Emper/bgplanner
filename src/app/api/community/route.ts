import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { threadCreateSchema } from "@/lib/validations";
import { THREADS_PAGE_SIZE, isCommunityTag } from "@/lib/community";
import { AUTHOR_SELECT, countRecentThreads, publicAuthor } from "@/lib/communityServer";
import { truncateChars } from "@/lib/text";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const EXCERPT_CHARS = 220;
const MAX_THREADS_PER_HOUR = 5;

const LIST_SELECT = {
  id: true,
  title: true,
  body: true,
  tag: true,
  pinned: true,
  createdAt: true,
  lastActivityAt: true,
  author: { select: AUTHOR_SELECT },
  _count: { select: { replies: { where: { deletedAt: null } } } },
  replies: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true, author: { select: AUTHOR_SELECT } },
  },
} satisfies Prisma.CommunityThreadSelect;

type ListRow = Prisma.CommunityThreadGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(t: ListRow) {
  const last = t.replies[0];
  return {
    id: t.id,
    title: t.title,
    excerpt: truncateChars(t.body.replace(/\s+/g, " ").trim(), EXCERPT_CHARS),
    tag: t.tag,
    pinned: t.pinned,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
    author: publicAuthor(t.author),
    replyCount: t._count.replies,
    lastReply: last ? { createdAt: last.createdAt, author: publicAuthor(last.author) } : null,
  };
}

// El cursor es "<lastActivityAt ISO>_<id>": la fecha sola puede repetirse.
function parseCursor(raw: string | null) {
  if (!raw) return null;
  const sep = raw.lastIndexOf("_");
  if (sep <= 0) return null;
  const date = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(date.getTime()) || !id) return null;
  return { date, id };
}

// Listado del foro. Se lee sin cuenta. Los fijados van siempre arriba en la
// primera página; el resto, por última actividad (una respuesta "sube" el
// hilo), paginado por cursor.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  const params = request.nextUrl.searchParams;
  const tagParam = params.get("tag");
  const tag = isCommunityTag(tagParam) ? tagParam : null;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const cursor = parseCursor(params.get("cursor"));

  const base: Prisma.CommunityThreadWhereInput = {
    deletedAt: null,
    ...(tag ? { tag } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Al buscar, los fijados no se apartan: compiten como uno más.
  const separatePinned = !q;

  const [pinned, rows, tagCounts, isAdmin] = await Promise.all([
    separatePinned && !cursor
      ? prisma.communityThread.findMany({
          where: { ...base, pinned: true },
          orderBy: { lastActivityAt: "desc" },
          select: LIST_SELECT,
        })
      : Promise.resolve([] as ListRow[]),
    prisma.communityThread.findMany({
      where: {
        ...base,
        ...(separatePinned ? { pinned: false } : {}),
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { lastActivityAt: { lt: cursor.date } },
                    { lastActivityAt: cursor.date, id: { lt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: THREADS_PAGE_SIZE + 1,
      select: LIST_SELECT,
    }),
    // Cuántos hilos hay por etiqueta, para los filtros. Solo en la primera
    // página: luego no cambia.
    cursor
      ? Promise.resolve(null)
      : prisma.communityThread.groupBy({
          by: ["tag"],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
    isSuperadmin(session),
  ]);

  const hasMore = rows.length > THREADS_PAGE_SIZE;
  const page = rows.slice(0, THREADS_PAGE_SIZE);
  const last = page[page.length - 1];

  return NextResponse.json(
    {
      isLoggedIn: !!session,
      isAdmin,
      threads: [...pinned, ...page].map(toListItem),
      nextCursor: hasMore && last ? `${last.lastActivityAt.toISOString()}_${last.id}` : null,
      tagCounts: tagCounts
        ? Object.fromEntries(tagCounts.map((c) => [c.tag, c._count._all]))
        : undefined,
    },
    NO_STORE
  );
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
