import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getPublicGroup, groupTagline } from "@/lib/publicLinks";
import { getGroupType } from "@/lib/groupTypes";
import PublicPeek from "@/components/PublicPeek";
import GroupClient from "./GroupClient";

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

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session) return <GroupClient />;

  const { id } = await params;
  const group = await getPublicGroup(id);

  if (!group) {
    return (
      <PublicPeek
        emoji="🔍"
        title="Este grupo no existe"
        note="Puede que lo hayan borrado o que el enlace esté mal copiado."
        cta={{ href: "/", label: "Ir a BG Planner" }}
      />
    );
  }

  // Lo mismo que se ve en el listado de grupos y nada más: ni quién está
  // dentro, ni qué juegos tienen, ni cómo va el ranking.
  const cfg = getGroupType(group.type);
  const facts = [
    `${cfg.emoji} ${cfg.label}`,
    `👥 ${group.memberCount} jugador${group.memberCount === 1 ? "" : "es"}${
      group.gameCount > 0
        ? ` · 🎲 ${group.gameCount} juego${group.gameCount === 1 ? "" : "s"}`
        : ""
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
        href: `/login?redirect=${encodeURIComponent(`/groups/${id}`)}`,
        label: "Entrar",
        hint: "¿No eres del grupo? Pide a alguien de dentro que te mande su enlace de invitación.",
      }}
    />
  );
}
