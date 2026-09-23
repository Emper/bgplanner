import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import {
  getPublicEvent,
  eventTagline,
  formatEventWhen,
} from "@/lib/publicLinks";
import PublicPeek from "@/components/PublicPeek";
import EventClient from "./EventClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Cambia según quién mire y con datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicEvent(id);

  if (!event) {
    return {
      title: "Evento no encontrado · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  // De un evento privado no sale nada fuera de la app: ni el nombre en el
  // título, ni descripción, ni imagen. `images: []` desactiva la tarjeta que
  // Next enlazaría sola por existir opengraph-image.tsx.
  if (!event.isPublic) {
    const titulo = "Evento privado · BG Planner";
    const texto = "Solo pueden verlo quienes están invitados.";
    return {
      title: titulo,
      description: texto,
      robots: { index: false, follow: false },
      openGraph: { title: titulo, description: texto, images: [] },
      twitter: { card: "summary", title: titulo, description: texto },
    };
  }

  const description = eventTagline(event);
  return {
    title: `${event.name} · BG Planner`,
    description,
    alternates: { canonical: `${APP_URL}/events/${event.id}` },
    openGraph: {
      title: event.name,
      description,
      url: `${APP_URL}/events/${event.id}`,
      type: "website",
      siteName: "BG Planner",
      locale: "es_ES",
    },
    twitter: { card: "summary_large_image", title: event.name, description },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session) return <EventClient />;

  const { id } = await params;
  const event = await getPublicEvent(id);

  if (!event) {
    return (
      <PublicPeek
        emoji="🔍"
        title="Este evento no existe"
        note="Puede que lo hayan borrado o que el enlace esté mal copiado."
        cta={{ href: "/", label: "Ir a BG Planner" }}
      />
    );
  }

  // Los privados enseñan el cartel y poco más: ni nombre, ni fecha, ni sitio.
  if (!event.isPublic) {
    return (
      <PublicPeek
        emoji="🔒"
        title="Este evento es privado"
        note="Solo pueden verlo quienes están invitados. Si te han invitado, entra con tu cuenta y lo tendrás en tus eventos."
        cta={{
          href: `/login?redirect=${encodeURIComponent(`/events/${id}`)}`,
          label: "Entrar",
        }}
      />
    );
  }

  const facts = [
    `🗓️ ${formatEventWhen(event.date)}`,
    event.location ? `📍 ${event.location}` : null,
    `👥 ${event.attendeeCount} apuntado${event.attendeeCount === 1 ? "" : "s"}${
      event.maxAttendees ? ` de ${event.maxAttendees}` : ""
    }${
      event.gameCount > 0
        ? ` · 🎲 ${event.gameCount} juego${event.gameCount === 1 ? "" : "s"}`
        : ""
    }`,
  ].filter((f): f is string => !!f);

  return (
    <PublicPeek
      eyebrow="Evento abierto"
      title={event.name}
      imageUrl={event.imageUrl}
      emoji="🎉"
      facts={facts}
      note="Entra con tu cuenta de BG Planner para apuntarte, ver los juegos que se llevan y decir cuáles te apetecen."
      cta={{
        href: `/login?redirect=${encodeURIComponent(`/events/${id}`)}`,
        label: "Entrar y apuntarme",
        hint: "Crear una cuenta es solo tu email, sin contraseñas.",
      }}
    />
  );
}
