import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getEventDetail } from "@/lib/eventDetail";
import { EVENT_FEED_LIMIT, getEventFeed } from "@/lib/eventFeed";
import {
  getPublicEvent,
  eventTagline,
  formatEventWhen,
  type PublicEventInfo,
} from "@/lib/publicLinks";
import { excerpt, plural } from "@/lib/text";
import { APP_URL, loginHref } from "@/lib/site";
import { jsonLdHtml } from "@/lib/html";
import PublicPeek from "@/components/PublicPeek";
import RichText from "@/components/RichText";
import SignupBanner from "@/components/SignupBanner";
import { ButtonLink } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import EventClient, { type EventData, type EventFeedPage } from "./EventClient";

// Cambia según quién mire y con datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

// Como en GET /api/events/[id]: si el evento toma sus juegos de una lista de
// BGG, al abrirlo se reimporta después de responder y BGG puede tardar.
export const maxDuration = 300;

/**
 * El evento (y, si se abre en la pestaña Actividad, la primera página de su
 * feed) pedidos en el servidor y a la vez. Si no existe o es privado y no
 * estás invitado, el cliente enseña su aviso de siempre.
 */
async function EventDetail({
  eventId,
  userId,
  withFeed,
}: {
  eventId: string;
  userId: string;
  withFeed: boolean;
}) {
  let data: { event: EventData; feed?: EventFeedPage } | null = null;
  let error: string | null = null;
  try {
    const [event, feed] = await Promise.all([
      getEventDetail(eventId, userId),
      withFeed ? getEventFeed(eventId, userId, { limit: EVENT_FEED_LIMIT, cursor: null }) : null,
    ]);
    // Por JSON, para que llegue con la misma forma que por la API (fechas
    // como texto, etc.)
    data = JSON.parse(JSON.stringify({ event, feed: feed ?? undefined }));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    error = err.message;
  }

  if (!data) return <EventClient initialError={error ?? "Evento no encontrado"} />;
  return <EventClient initial={data.event} initialFeed={data.feed} />;
}

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (session) {
    const [{ id: eventId }, { tab }] = await Promise.all([params, searchParams]);
    // La pestaña por defecto es Actividad: solo entonces hace falta el feed.
    // Con otra (o una rara) lo pide el cliente si llega a abrirla.
    const withFeed = tab === undefined || tab === "activity";
    // La cabecera sale ya; el evento llega en cuanto está, sin congelar la
    // navegación mientras tanto
    return (
      <Suspense
        fallback={
          <>
            <Navbar />
            <PageLoader withNavbar />
          </>
        }
      >
        <EventDetail eventId={eventId} userId={session.userId} withFeed={withFeed} />
      </Suspense>
    );
  }

  const { id } = await params;
  const event = await getPublicEvent(id);

  // Un 404 de verdad, que los buscadores lo olviden.
  if (!event) notFound();

  // Los privados enseñan el cartel y poco más: ni nombre, ni fecha, ni sitio.
  if (!event.isPublic) {
    return (
      <PublicPeek
        emoji="🔒"
        title="Este evento es privado"
        note="Solo pueden verlo quienes están invitados. Si te han invitado, entra con tu cuenta y lo tendrás en tus eventos."
        cta={{
          href: loginHref(`/events/${id}`),
          label: "Entrar",
        }}
      />
    );
  }

  const facts = [
    `🗓️ ${formatEventWhen(event.date)}`,
    event.location ? `📍 ${event.location}` : null,
    `👥 ${plural(event.attendeeCount, "apuntado", "apuntados")}${
      event.maxAttendees ? ` de ${event.maxAttendees}` : ""
    }${
      event.gameCount > 0 ? ` · 🎲 ${plural(event.gameCount, "juego", "juegos")}` : ""
    }`,
  ].filter((f): f is string => !!f);

  const signInHref = loginHref(`/events/${id}`);
  const about = event.about?.trim();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(eventJsonLd(event)) }}
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
          href: signInHref,
          label: "Entrar y apuntarme",
          hint: "Crear una cuenta es solo tu email, sin contraseñas.",
        }}
      >
        {about ? (
          <section className={cardClass({ padding: "none", className: "p-6 sm:p-7" })}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-3">Sobre el evento</h2>
            <RichText text={about} />
            <div className="mt-6 pt-5 border-t border-[var(--border)] text-center">
              <ButtonLink href={signInHref} size="lg">
                Me apunto
              </ButtonLink>
            </div>
          </section>
        ) : null}
      </PublicPeek>
    </>
  );
}
