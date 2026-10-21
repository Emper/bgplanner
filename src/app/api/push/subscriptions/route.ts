import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validations";
import { vapidPublicKey } from "@/lib/push";
import { logActivity } from "@/lib/activity";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";

// Como mucho estos dispositivos por persona; al pasarse se olvidan los que
// llevan más tiempo sin recibir nada.
const MAX_DEVICES = 10;

/**
 * Lo que necesita el interruptor de «Avisarme en este dispositivo»: la clave
 * pública para suscribirse y si el `endpoint` de este navegador ya está
 * apuntado a tu cuenta (puede estarlo a otra si compartís dispositivo).
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const publicKey = vapidPublicKey();
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  const subscribed =
    !!publicKey &&
    !!endpoint &&
    (await prisma.pushSubscription.count({ where: { endpoint, userId: session.userId } })) > 0;

  return NextResponse.json({ publicKey, subscribed });
});

/** Apunta este dispositivo a tu cuenta (o renueva sus claves). */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  if (!vapidPublicKey()) {
    throw new ApiError(503, "Los avisos al móvil no están disponibles ahora mismo");
  }

  const { endpoint, keys, source } = await parseBody(request, pushSubscriptionSchema);
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  // Solo cuenta como activación si este dispositivo no estaba ya apuntado a ti
  const known = await prisma.pushSubscription.count({ where: { endpoint, userId: session.userId } });

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: {
      userId: session.userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      lastUsedAt: new Date(),
    },
  });

  const stale = await prisma.pushSubscription.findMany({
    where: { userId: session.userId },
    orderBy: { lastUsedAt: "desc" },
    skip: MAX_DEVICES,
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  if (known === 0) logActivity("push_enabled", session.userId, { source: source ?? "settings" });

  return NextResponse.json({ subscribed: true });
});

/** Deja de avisar en este dispositivo. */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { endpoint } = await parseBody(request, pushUnsubscribeSchema);

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.userId },
  });
  return NextResponse.json({ subscribed: false });
});
