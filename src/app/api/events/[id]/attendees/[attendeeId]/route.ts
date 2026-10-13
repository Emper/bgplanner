import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventAttendeeRoleSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// Cambia el rol de un asistente (attendee <-> admin). Igual que en grupos:
// el creador y los admins pueden nombrar admins, pero quitarle el rol a un
// admin solo puede el creador. Al creador no se le toca.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId, attendeeId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, createdById: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const isCreator = event.createdById === session.userId;
  if (!isCreator) {
    const requester = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId: session.userId } },
      select: { role: true },
    });
    if (requester?.role !== "admin") {
      return NextResponse.json({ error: "Solo quien gestiona el evento puede nombrar admins" }, { status: 403 });
    }
  }

  const body = await request.json();
  const parsed = eventAttendeeRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { role } = parsed.data;

  const target = await prisma.eventAttendee.findUnique({
    where: { id: attendeeId },
    select: { id: true, eventId: true, userId: true, role: true, user: { select: { name: true, displayName: true } } },
  });
  if (!target || target.eventId !== eventId) {
    return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 });
  }
  if (target.userId === event.createdById) {
    return NextResponse.json({ error: "El creador del evento ya lo gestiona" }, { status: 400 });
  }
  if (target.userId === session.userId) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }
  if (target.role === "admin" && role === "attendee" && !isCreator) {
    return NextResponse.json({ error: "Solo el creador del evento puede quitar admins" }, { status: 403 });
  }

  if (target.role !== role) {
    await prisma.eventAttendee.update({ where: { id: target.id }, data: { role } });
    logActivity(role === "admin" ? "member_promoted" : "member_demoted", session.userId, {
      eventId,
      targetName: target.user.displayName || target.user.name || "un asistente",
    });
  }

  return NextResponse.json({ success: true, role });
}
