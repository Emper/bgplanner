import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { deleteAccount, getDeletionPlan } from "@/lib/accountDeletion";
import { accountDeleteSchema } from "@/lib/validations";

// GET: qué pasará al borrar la cuenta (grupos y eventos que cambian de manos
// o desaparecen, y lo que se queda anonimizado). Lo pinta el modal.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const plan = await getDeletionPlan(session.userId);
  return NextResponse.json(plan);
}

// DELETE: borra la cuenta de quien tiene la sesión y la cierra.
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = accountDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let result;
  try {
    result = await deleteAccount(session.userId, { removePhotos: parsed.data.removePhotos });
  } catch (err) {
    console.error("[account] fallo al borrar la cuenta:", err);
    return NextResponse.json(
      { error: "No hemos podido borrar la cuenta. No se ha tocado nada: inténtalo de nuevo o escríbenos." },
      { status: 500 }
    );
  }

  const { ghostId, plan } = result;
  for (const g of plan.groups) {
    if (g.heir) notify({ type: "group_inherited", userIds: [g.heir.userId], groupId: g.id });
  }
  for (const e of plan.events) {
    if (e.heir) notify({ type: "event_inherited", userIds: [e.heir.userId], eventId: e.id });
  }

  // Sin datos personales: va a nombre del fantasma y solo lleva cifras.
  logActivity("account_deleted", ghostId, {
    groupsHandedOver: plan.groups.filter((g) => g.heir).length,
    groupsDeleted: plan.groups.filter((g) => !g.heir).length,
    eventsHandedOver: plan.events.filter((e) => e.heir).length,
    eventsDeleted: plan.events.filter((e) => !e.heir).length,
    photosRemoved: parsed.data.removePhotos,
  });

  const response = NextResponse.json({ deleted: true });
  response.cookies.set("session", "", { maxAge: 0, path: "/" });
  return response;
}
