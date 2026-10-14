import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validations";
import { vapidPublicKey } from "@/lib/push";

// Como mucho estos dispositivos por persona; al pasarse se olvidan los que
// llevan más tiempo sin recibir nada.
const MAX_DEVICES = 10;

/**
 * Lo que necesita el interruptor de «Avisarme en este dispositivo»: la clave
 * pública para suscribirse y si el `endpoint` de este navegador ya está
 * apuntado a tu cuenta (puede estarlo a otra si compartís dispositivo).
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const publicKey = vapidPublicKey();
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  const subscribed =
    !!publicKey &&
    !!endpoint &&
    (await prisma.pushSubscription.count({ where: { endpoint, userId: session.userId } })) > 0;

  return NextResponse.json({ publicKey, subscribed });
}

/** Apunta este dispositivo a tu cuenta (o renueva sus claves). */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!vapidPublicKey()) {
    return NextResponse.json({ error: "Los avisos al móvil no están disponibles ahora mismo" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

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

  return NextResponse.json({ subscribed: true });
}

/** Deja de avisar en este dispositivo. */
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: session.userId },
  });
  return NextResponse.json({ subscribed: false });
}
