import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getGroupDashboard } from "@/lib/groupDashboard";
import { getGroupFeed, GROUP_FEED_LIMIT } from "@/lib/groupFeed";
import { groupTabFromParam } from "@/lib/groupTabs";
import { getPublicGroup, groupTagline } from "@/lib/publicLinks";
import { getGroupType } from "@/lib/groupTypes";
import { loginHref } from "@/lib/site";
import { plural } from "@/lib/text";
import PublicPeek from "@/components/PublicPeek";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import GroupClient, { type GroupInitial } from "./GroupClient";

// Cambia según quién mire y con datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const group = await getPublicGroup(id);

  if (!group) {
    return {
      title: "Grupo no encontrado · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  const description = groupTagline(group);
  // Un grupo no es un escaparate: se ve si te pasan el enlace, pero no se
  // indexa. Lo de dentro sigue pidiendo cuenta y ser miembro.
  return {
    title: `${group.name} · BG Planner`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: group.name,
      description,
      type: "website",
      siteName: "BG Planner",
      locale: "es_ES",
    },
    twitter: { card: "summary_large_image", title: group.name, description },
  };
}

// Los datos de la ficha para un miembro, pedidos en el servidor: llegan en
// la misma respuesta (en streaming tras el loader) en vez de esperar a que
// arranque el JS. El feed solo si la pestaña que se abre es la de actividad.
async function GroupData({
  groupId,
  userId,
  tab,
}: {
  groupId: string;
  userId: string;
  tab: string | null;
}) {
  const withFeed = groupTabFromParam(tab) === "activity";
  let initial: GroupInitial;
  try {
    const [dashboard, feed] = await Promise.all([
      getGroupDashboard(groupId, userId),
      withFeed ? getGroupFeed(groupId, userId, { limit: GROUP_FEED_LIMIT, cursor: null }) : null,
    ]);
    // Misma forma que la API (fechas como texto) para que el cliente no note
    // de dónde vienen.
    initial = JSON.parse(JSON.stringify({ dashboard, feed }));
  } catch (err) {
    // No es miembro (o el grupo no existe): el mismo aviso que pinta el
    // cliente cuando la API le contesta con error.
    if (err instanceof ApiError) return <GroupClient initialError="Error al cargar el grupo" />;
    throw err;
  }
  return <GroupClient initial={initial} />;
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await getSession();
  if (session) {
    const [{ id }, { tab }] = await Promise.all([params, searchParams]);
    return (
      <Suspense
        fallback={
          <>
            <Navbar />
            <PageLoader withNavbar />
          </>
        }
      >
        <GroupData
          groupId={id}
          userId={session.userId}
          tab={typeof tab === "string" ? tab : null}
        />
      </Suspense>
    );
  }

  const { id } = await params;
  const group = await getPublicGroup(id);

  // Un 404 de verdad (con la cara de la app de src/app/not-found.tsx).
  if (!group) notFound();

  // Lo mismo que se ve en el listado de grupos y nada más: ni quién está
  // dentro, ni qué juegos tienen, ni cómo va el ranking.
  const cfg = getGroupType(group.type);
  const facts = [
    `${cfg.emoji} ${cfg.label}`,
    `👥 ${plural(group.memberCount, "jugador", "jugadores")}${
      group.gameCount > 0 ? ` · 🎲 ${plural(group.gameCount, "juego", "juegos")}` : ""
    }`,
  ];

  return (
    <PublicPeek
      eyebrow="Grupo de BG Planner"
      title={group.name}
      emoji={cfg.emoji}
      facts={facts}
      note="Lo que pasa dentro (quién está, qué juegos tienen y cómo va el ranking) es cosa de sus miembros. Si eres uno, entra con tu cuenta."
      cta={{
        href: loginHref(`/groups/${id}`),
        label: "Entrar",
        hint: "¿No eres del grupo? Pide a alguien de dentro que te mande su enlace de invitación.",
      }}
    />
  );
}
