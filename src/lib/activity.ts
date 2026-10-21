import { prisma } from "./prisma";
import { inBackground } from "./background";
import { PUBLIC_TYPES, type ActivityType } from "./activityFormat";

// Registrar actividad (solo servidor). La presentación vive en
// ./activityFormat, que es lo que importan los componentes de cliente.
export * from "./activityFormat";

export function logActivity(
  type: ActivityType,
  userId: string,
  opts: { groupId?: string; eventId?: string; [key: string]: unknown } = {}
) {
  const { groupId, eventId, ...rest } = opts;
  const scope = PUBLIC_TYPES.has(type) ? "public" : "internal";
  // Después de responder: ni retrasa la respuesta ni se pierde en Vercel.
  inBackground(() =>
    prisma.activityLog.create({
      data: {
        type,
        scope,
        userId,
        groupId: (groupId as string) || null,
        eventId: (eventId as string) || null,
        metadata: rest as Record<string, string | number | boolean | null>,
      },
    })
  );
}
