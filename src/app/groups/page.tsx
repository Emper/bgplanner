import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth";
import { listMyGroups } from "@/lib/groupList";
import GroupsList, { type GroupListItem } from "./GroupsList";

// Todos tus grupos. La portada con la actividad es / (con sesión).
// La cabecera sale al instante y la lista llega en la misma respuesta en
// cuanto está (Suspense): sin el viaje de más desde el navegador.

export const dynamic = "force-dynamic";

export default function GroupsPage() {
  return (
    <PageShell nav={<Navbar />} width="main">
      <PageHeader
        title="Mis grupos"
        action={
          <ButtonLink href="/groups/new" prefetch={false} className="py-2.5">
            Crear grupo
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageLoader withNavbar />}>
        <GroupsData />
      </Suspense>
    </PageShell>
  );
}

async function GroupsData() {
  // La ruta está protegida por el proxy: aquí siempre hay sesión.
  const session = await getSession();
  if (!session) return null;
  // Misma forma que daba GET /api/groups (fechas como texto).
  const groups: GroupListItem[] | null = await listMyGroups(session.userId)
    .then((list) => JSON.parse(JSON.stringify(list)))
    .catch((err) => {
      console.error("[groups] no se pudo cargar la lista", err);
      return null;
    });
  if (!groups) return <Alert>Error al cargar los grupos</Alert>;
  return <GroupsList initialGroups={groups} />;
}
