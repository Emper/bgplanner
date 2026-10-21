import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { deleteAccount, getDeletionPlan } from "@/lib/accountDeletion";
import { accountDeleteSchema } from "@/lib/validations";

// GET: qué pasará al borrar la cuenta (grupos y eventos que cambian de manos
// o desaparecen, y lo que se queda anonimizado). Lo pinta el modal.
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const plan = await getDeletionPlan(session.userId);
  return NextResponse.json(plan);
});

// DELETE: borra la cuenta de quien tiene la sesión y la cierra.
export const DELETE = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { removePhotos } = await parseBody(request, accountDeleteSchema);

  let result;
  try {
    result = await deleteAccount(session.userId, { removePhotos });
  } catch (err) {
    console.error("[account] fallo al borrar la cuenta:", err);
    throw new ApiError(
      500,
      "No hemos podido borrar la cuenta. No se ha tocado nada: inténtalo de nuevo o escríbenos."
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
    photosRemoved: removePhotos,
  });

  const response = NextResponse.json({ deleted: true });
  response.cookies.set("session", "", { maxAge: 0, path: "/" });
  return response;
});
