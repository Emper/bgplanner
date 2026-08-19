import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession, isSuperadmin, sessionCookieOptions } from "@/lib/auth";
import { profileSchema, deleteAccountSchema } from "@/lib/validations";
import { validateBggUsername } from "@/lib/bgg";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      location: true,
      bggUsername: true,
      avatarUrl: true,
      displayName: true,
      role: true,
    },
  });

  const superadmin = await isSuperadmin(session);

  return NextResponse.json({ ...user, isSuperadmin: superadmin });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Resolve displayName: use provided value, or fall back to name
  const data: Record<string, unknown> = { ...parsed.data };
  if (!data.displayName || (data.displayName as string).trim() === "") {
    data.displayName = parsed.data.name;
  }

  // Validate BGG username if provided
  if (data.bggUsername && (data.bggUsername as string).trim()) {
    data.bggUsername = (data.bggUsername as string).trim().toLowerCase();
    const validation = await validateBggUsername(data.bggUsername as string);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      location: true,
      bggUsername: true,
      avatarUrl: true,
      displayName: true,
    },
  });

  return NextResponse.json(user);
}

// PATCH — update avatar only
export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { avatarUrl } = body;

  if (typeof avatarUrl !== "string" && avatarUrl !== null) {
    return NextResponse.json({ error: "avatarUrl inválido" }, { status: 400 });
  }

  // Limit base64 size (~150KB max for a resized avatar)
  if (avatarUrl && avatarUrl.length > 200000) {
    return NextResponse.json({ error: "Imagen demasiado grande" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl },
    select: { avatarUrl: true },
  });

  return NextResponse.json(user);
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE — borrado de cuenta (requisito 5.1.1(v) de la App Store)
//
// El esquema NO tiene `onDelete: Cascade` en ninguna relación que apunte a
// `User`, así que `prisma.user.delete()` a secas falla por clave ajena. El
// borrado se hace a mano dentro de una transacción, con dos criterios:
//
//   · Contenido personal (votos, comentarios, opiniones, fotos, asistencias,
//     pertenencias, actividad) → se borra.
//   · Contenido que es del grupo o del evento y no de la persona
//     (juegos añadidos, sesiones, el propio grupo/evento) → NO se borra: se
//     reasigna la autoría a otro miembro para no destruir datos ajenos.
//     Solo se borra el grupo/evento entero si el usuario era el único que
//     quedaba en él (ahí sí funcionan las cascadas del esquema).
// ─────────────────────────────────────────────────────────────────────────

function roleRank(role: string): number {
  if (role === "owner") return 0;
  if (role === "admin") return 1;
  return 2;
}

/**
 * Elige a quién se le traspasa lo que quede del grupo/evento: primero el
 * admin (u owner) más antiguo, y si no hay ninguno, el miembro más antiguo.
 * Devuelve null si no queda nadie → el grupo/evento se borra entero.
 */
function pickSuccessor(
  candidates: { userId: string; role: string; joinedAt: Date }[],
  createdById: string,
  userId: string
): string | null {
  const others = candidates
    .filter((c) => c.userId !== userId)
    .sort(
      (a, b) =>
        roleRank(a.role) - roleRank(b.role) ||
        a.joinedAt.getTime() - b.joinedAt.getTime()
    );
  if (others.length > 0) return others[0].userId;
  // Sin miembros/asistentes, pero puede que lo creara otra persona.
  return createdById !== userId ? createdById : null;
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, bggUsername: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (
    parsed.data.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "El email no coincide con el de tu cuenta" },
      { status: 400 }
    );
  }

  const userId = user.id;

  // ── 1. Lectura previa: decidir sucesor de cada grupo/evento ────────────
  const [groups, events] = await Promise.all([
    prisma.group.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
          { games: { some: { addedById: userId } } },
          { sessions: { some: { createdById: userId } } },
        ],
      },
      select: {
        id: true,
        createdById: true,
        members: { select: { userId: true, role: true, joinedAt: true } },
      },
    }),
    prisma.event.findMany({
      where: {
        OR: [
          { createdById: userId },
          { attendees: { some: { userId } } },
          { games: { some: { addedById: userId } } },
        ],
      },
      select: {
        id: true,
        createdById: true,
        attendees: {
          select: { userId: true, status: true, joinedAt: true },
        },
      },
    }),
  ]);

  const groupsToDelete: string[] = [];
  const groupTransfers: { groupId: string; successorId: string; wasCreator: boolean }[] = [];
  for (const g of groups) {
    const successorId = pickSuccessor(g.members, g.createdById, userId);
    if (successorId) {
      groupTransfers.push({
        groupId: g.id,
        successorId,
        wasCreator: g.createdById === userId,
      });
    } else {
      groupsToDelete.push(g.id);
    }
  }

  const eventsToDelete: string[] = [];
  const eventTransfers: { eventId: string; successorId: string }[] = [];
  for (const e of events) {
    // Los "cancelled" van al final: valen como sucesor, pero solo si no hay
    // nadie apuntado de verdad.
    const candidates = e.attendees.map((a) => ({
      userId: a.userId,
      role: a.status === "cancelled" ? "member" : "admin",
      joinedAt: a.joinedAt,
    }));
    const successorId = pickSuccessor(candidates, e.createdById, userId);
    if (successorId) {
      eventTransfers.push({ eventId: e.id, successorId });
    } else {
      eventsToDelete.push(e.id);
    }
  }

  // ── 2. Fotos a limpiar de Supabase Storage ─────────────────────────────
  // Las del usuario, más las de los grupos/eventos que se borran enteros.
  // Best-effort: si Storage no está configurado o falla, el borrado en BD
  // sigue adelante y como mucho quedan ficheros huérfanos en el bucket.
  const photoUrls: string[] = [];
  const reviewPhotoWhere: Prisma.GameReviewPhotoWhereInput[] = [
    { review: { userId } },
  ];
  const groupPhotoWhere: Prisma.GroupPhotoWhereInput[] = [{ userId }];
  const eventPhotoWhere: Prisma.EventPhotoWhereInput[] = [{ userId }];
  if (groupsToDelete.length > 0) {
    reviewPhotoWhere.push({
      review: { groupGame: { groupId: { in: groupsToDelete } } },
    });
    groupPhotoWhere.push({ groupId: { in: groupsToDelete } });
  }
  if (eventsToDelete.length > 0) {
    eventPhotoWhere.push({ eventId: { in: eventsToDelete } });
  }
  try {
    const [reviewPhotos, groupPhotos, eventPhotos] = await Promise.all([
      prisma.gameReviewPhoto.findMany({
        where: { OR: reviewPhotoWhere },
        select: { url: true },
      }),
      prisma.groupPhoto.findMany({
        where: { OR: groupPhotoWhere },
        select: { url: true },
      }),
      prisma.eventPhoto.findMany({
        where: { OR: eventPhotoWhere },
        select: { url: true },
      }),
    ]);
    photoUrls.push(
      ...reviewPhotos.map((p) => p.url),
      ...groupPhotos.map((p) => p.url),
      ...eventPhotos.map((p) => p.url)
    );
  } catch {
    // Si falla la recogida de URLs no bloqueamos el borrado de la cuenta.
  }

  // ── 3. Borrado transaccional ───────────────────────────────────────────
  // Se usa la forma por lotes de `$transaction` (array de operaciones): nada
  // de lo que va dentro depende del resultado de lo anterior, y así todo
  // viaja en una única transacción, igual que en el resto del repo.
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // 3.1 Contenido estrictamente personal.
  ops.push(prisma.vote.deleteMany({ where: { userId } }));
  ops.push(prisma.gameComment.deleteMany({ where: { userId } }));
  // Las fotos de las opiniones caen por cascada (GameReviewPhoto).
  ops.push(prisma.gameReview.deleteMany({ where: { userId } }));
  ops.push(prisma.eventReview.deleteMany({ where: { userId } }));
  ops.push(prisma.eventPhoto.deleteMany({ where: { userId } }));
  ops.push(prisma.groupPhoto.deleteMany({ where: { userId } }));
  // Intereses en juegos de evento: caerían por cascada al borrar el
  // EventAttendee, pero los quitamos explícitamente por claridad.
  ops.push(
    prisma.eventGameInterest.deleteMany({ where: { attendee: { userId } } })
  );

  // 3.2 Reasignación de autoría en grupos que sobreviven.
  for (const t of groupTransfers) {
    ops.push(
      prisma.groupGame.updateMany({
        where: { groupId: t.groupId, addedById: userId },
        data: { addedById: t.successorId },
      })
    );
    ops.push(
      prisma.gameSession.updateMany({
        where: { groupId: t.groupId, createdById: userId },
        data: { createdById: t.successorId },
      })
    );
    if (t.wasCreator) {
      ops.push(
        prisma.group.updateMany({
          where: { id: t.groupId, createdById: userId },
          data: { createdById: t.successorId },
        })
      );
      // El sucesor pasa a ser propietario del grupo (si es miembro).
      ops.push(
        prisma.groupMember.updateMany({
          where: {
            groupId: t.groupId,
            userId: t.successorId,
            role: { not: "owner" },
          },
          data: { role: "owner" },
        })
      );
    }
  }

  // 3.3 Reasignación de autoría en eventos que sobreviven.
  for (const t of eventTransfers) {
    ops.push(
      prisma.eventGame.updateMany({
        where: { eventId: t.eventId, addedById: userId },
        data: { addedById: t.successorId },
      })
    );
    ops.push(
      prisma.event.updateMany({
        where: { id: t.eventId, createdById: userId },
        data: { createdById: t.successorId },
      })
    );
  }

  // 3.4 Grupos y eventos en los que no queda nadie más: se borran enteros y
  // las cascadas del esquema se llevan miembros, juegos, sesiones,
  // invitaciones, fotos y actividad asociada.
  if (groupsToDelete.length > 0) {
    ops.push(prisma.group.deleteMany({ where: { id: { in: groupsToDelete } } }));
  }
  if (eventsToDelete.length > 0) {
    ops.push(prisma.event.deleteMany({ where: { id: { in: eventsToDelete } } }));
  }

  // 3.5 Pertenencias y asistencias que queden (grupos/eventos vivos).
  ops.push(prisma.groupMember.deleteMany({ where: { userId } }));
  ops.push(prisma.eventAttendee.deleteMany({ where: { userId } }));

  // 3.6 Moderación. `Report` y `Block` apuntan a `User` sin cascada, así que
  // hay que borrarlos a mano o el `user.delete` final falla por clave ajena.
  // Los bloqueos se borran en ambos sentidos: los que hizo y los que recibió.
  // (`NotificationPreference` y `DeviceToken` sí tienen onDelete: Cascade.)
  ops.push(prisma.report.deleteMany({ where: { reporterId: userId } }));
  ops.push(
    prisma.block.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    })
  );

  // 3.7 Actividad, invitaciones pendientes a su email, códigos OTP, caché de
  // su colección de BGG y por fin el usuario.
  ops.push(prisma.activityLog.deleteMany({ where: { userId } }));
  ops.push(
    prisma.groupInvitation.deleteMany({
      where: { email: { equals: user.email, mode: "insensitive" } },
    })
  );
  ops.push(
    prisma.otpCode.deleteMany({
      where: { email: { equals: user.email, mode: "insensitive" } },
    })
  );
  if (user.bggUsername) {
    // Solo es caché de datos públicos de BGG; se puede regenerar.
    ops.push(
      prisma.collectionGame.deleteMany({
        where: { bggUsername: user.bggUsername },
      })
    );
  }
  ops.push(prisma.user.delete({ where: { id: userId } }));

  try {
    await prisma.$transaction(ops);
  } catch (err) {
    console.error("[profile] fallo al borrar la cuenta:", err);
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // ── 4. Limpieza de Storage (best-effort, fuera de la transacción) ──────
  const paths = Array.from(
    new Set(
      photoUrls
        .map((url) => pathFromPublicUrl(url))
        .filter((p): p is string => !!p)
    )
  );
  if (paths.length > 0) {
    // Supabase acepta lotes; troceamos por si son muchas.
    for (let i = 0; i < paths.length; i += 100) {
      deletePhotos(paths.slice(i, i + 100)).catch(() => {});
    }
  }

  // ── 5. Cerrar sesión: cookie caducada con las mismas opciones ─────────
  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...sessionCookieOptions(""), maxAge: 0 });
  return response;
}
