import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventAttendeeRoleSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { ApiError, apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

// Cambia el rol de un asistente (attendee <-> admin). Igual que en grupos:
// el creador y los admins pueden nombrar admins, pero quitarle el rol a un
// admin solo puede el creador. Al creador no se le toca.
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string; attendeeId: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId, attendeeId } = await params;

    const [p, target] = await Promise.all([
      requireEventAccess(eventId, session.userId, "manage"),
      prisma.eventAttendee.findUnique({
        where: { id: attendeeId },
        select: { id: true, eventId: true, userId: true, role: true, user: { select: { name: true, displayName: true } } },
      }),
    ]);

    const { role } = await parseBody(request, eventAttendeeRoleSchema);

    if (!target || target.eventId !== eventId) throw new ApiError(404, "Asistente no encontrado");
    if (target.userId === p.event.createdById) {
      throw new ApiError(400, "El creador del evento ya lo gestiona");
    }
    if (target.userId === session.userId) throw new ApiError(400, "No puedes cambiar tu propio rol");
    if (target.role === "admin" && role === "attendee" && !p.isCreator) {
      throw new ApiError(403, "Solo el creador del evento puede quitar admins");
    }

    if (target.role !== role) {
      await prisma.eventAttendee.update({ where: { id: target.id }, data: { role } });
      logActivity(role === "admin" ? "member_promoted" : "member_demoted", session.userId, {
        eventId,
        targetName: target.user.displayName || target.user.name || "un asistente",
      });
      notify({
        type: "event_role_changed",
        userIds: [target.userId],
        actorId: session.userId,
        eventId,
        metadata: { role },
      });
    }

    return NextResponse.json({ success: true, role });
  }
);
