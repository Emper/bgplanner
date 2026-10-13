import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import {
  getPublicEvent,
  eventTagline,
  formatEventWhen,
  type PublicEventInfo,
} from "@/lib/publicLinks";
import { excerpt } from "@/lib/text";
import PublicPeek from "@/components/PublicPeek";
import RichText from "@/components/RichText";
import SignupBanner from "@/components/SignupBanner";
import EventClient from "./EventClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Cambia según quién mire y con datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

// Cuándo y dónde primero (es lo que se busca), y luego lo que cuente el
// organizador, hasta lo que cabe en un resultado de Google.
function eventDescription(event: PublicEventInfo): string {
  const summary = event.description?.trim() || event.about?.trim();
  return summary
    ? excerpt(`${eventTagline(event)} ${summary}`, 160)
    : eventTagline(event);
}

// Datos estructurados schema.org/Event: con ellos el evento puede salir en
// Google con su fecha y su sitio.
function eventJsonLd(event: PublicEventInfo) {
  const url = `${APP_URL}/events/${event.id}`;
  const full = event.maxAttendees != null && event.attendeeCount >= event.maxAttendees;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: excerpt(
      event.about?.trim() || event.description?.trim() || eventTagline(event),
      500
    ),
    startDate: event.date,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(event.location
      ? { location: { "@type": "Place", name: event.location, address: event.location } }
      : {}),
    // La portada del evento se guarda incrustada; la tarjeta de compartir
    // es una URL de verdad y lleva la misma imagen.
    image: [`${url}/opengraph-image`],
    url,
    isAccessibleForFree: true,
    ...(event.maxAttendees ? { maximumAttendeeCapacity: event.maxAttendees } : {}),
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "EUR",
      availability: full ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url,
    },
  };
}

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

  const description = eventDescription(event);
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

  const loginHref = `/login?redirect=${encodeURIComponent(`/events/${id}`)}`;
  const about = event.about?.trim();

  return (
    <>
      <script
        type="application/ld+json"
        // "<" escapado: que un nombre con "</script>" no cierre la etiqueta
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd(event)).replace(/</g, "\\u003c"),
        }}
      />
      <PublicPeek
        banner={
          <SignupBanner variant="event" redirect={`/events/${event.id}`} />
        }
        eyebrow="Evento abierto"
        title={event.name}
        lead={event.description}
        imageUrl={event.imageUrl}
        emoji="🎉"
        facts={facts}
        note="Entra con tu cuenta de BG Planner para apuntarte, ver los juegos que se llevan y decir cuáles te apetecen."
        cta={{
          href: loginHref,
          label: "Entrar y apuntarme",
          hint: "Crear una cuenta es solo tu email, sin contraseñas.",
        }}
      >
        {about ? (
          <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6 sm:p-7">
            <h2 className="text-lg font-bold text-[var(--text)] mb-3">Sobre el evento</h2>
            <RichText text={about} />
            <div className="mt-6 pt-5 border-t border-[var(--border)] text-center">
              <Link
                href={loginHref}
                className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Me apunto
              </Link>
            </div>
          </section>
        ) : null}
      </PublicPeek>
    </>
  );
}
