import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { getSession } from "@/lib/auth";
import { NOTIFICATIONS_PAGE_SIZE, getNotificationsPage } from "@/lib/notifications";
import type { NotificationsPage } from "@/components/NotificationList";
import NotificationsClient from "./NotificationsClient";

// La cabecera y el loader salen al instante; los avisos llegan en la misma
// respuesta en cuanto están (Suspense), sin el viaje de más desde el navegador.

export const dynamic = "force-dynamic";

export default function NotificationsPageView() {
  return (
    <Suspense
      fallback={
        <PageShell nav={<Navbar />} width="text">
          <PageHeader title="Notificaciones" />
          <PageLoader withNavbar />
        </PageShell>
      }
    >
      <NotificationsData />
    </Suspense>
  );
}

async function NotificationsData() {
  // La ruta está protegida por el proxy: aquí siempre hay sesión.
  const session = await getSession();
  // Misma forma que GET /api/notifications. Si falla, el cliente lo pide él.
  const initial: NotificationsPage | undefined = session
    ? await getNotificationsPage(session.userId, { limit: NOTIFICATIONS_PAGE_SIZE, cursor: null })
        .then((page) => JSON.parse(JSON.stringify(page)))
        .catch((err) => {
          console.error("[notifications] no se pudo cargar la lista", err);
          return undefined;
        })
    : undefined;
  return <NotificationsClient initial={initial} />;
}
