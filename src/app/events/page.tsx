import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getUpcomingPublicEvents,
  EVENT_TZ,
  type PublicEventInfo,
} from "@/lib/publicLinks";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import SignupBanner from "@/components/SignupBanner";
import DateTile from "@/components/DateTile";
import EventsClient from "./EventsClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Con sesión, tus eventos; sin ella, el escaparate de los próximos eventos
// abiertos (es lo que enlaza la portada y lo que encuentran los buscadores).
export const dynamic = "force-dynamic";

const TITLE = "Próximos eventos de juegos de mesa · BG Planner";
const DESCRIPTION =
  "Jornadas, quedadas y convenciones de juegos de mesa abiertas a todo el mundo. Apúntate, mira qué juegos se llevan y di cuáles te apetecen.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/events` },
  openGraph: {
    title: "Próximos eventos de juegos de mesa",
    description: DESCRIPTION,
    url: `${APP_URL}/events`,
    type: "website",
    siteName: "BG Planner",
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function when(event: PublicEventInfo): string {
  const d = new Date(event.date);
  const dia = d.toLocaleDateString("es-ES", {
    timeZone: EVENT_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = d.toLocaleTimeString("es-ES", {
    timeZone: EVENT_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} · ${hora}`;
}

function listJsonLd(events: PublicEventInfo[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Próximos eventos de juegos de mesa",
    itemListElement: events.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${APP_URL}/events/${e.id}`,
      name: e.name,
    })),
  };
}

export default async function EventsPage() {
  const session = await getSession();
  if (session) return <EventsClient />;

  const events = await getUpcomingPublicEvents(60).catch(() => []);

  return (
    <>
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(listJsonLd(events)).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <SmartNav />
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] page-pad">
        <div className="page-main">
          <SignupBanner variant="event" redirect="/events" />
          <h1 className="mt-4 page-title">
            Próximos eventos de juegos de mesa
          </h1>
          <p className="mt-2 page-lead max-w-2xl">
            Jornadas, quedadas y convenciones abiertas a todo el mundo. Entra en
            cualquiera para ver cuándo y dónde es, y apúntate para decir qué
            juegos te apetecen.
          </p>

          {events.length === 0 ? (
            <div className="mt-10 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10">
              <p className="text-4xl mb-3">📅</p>
              <p className="font-semibold">Ahora mismo no hay eventos abiertos</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                ¿Organizas unas jornadas? Crea el evento y que la gente se apunte.
              </p>
            </div>
          ) : (
            <ul className="mt-8 grid sm:grid-cols-2 gap-4">
              {events.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.id}`}
                    className="group block h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--primary)]/40 hover:shadow-[var(--card-shadow-hover)] transition-all duration-300"
                  >
                    <div className="relative h-32 fx-event-art overflow-hidden">
                      {ev.imageUrl && (
                        <Image
                          src={ev.imageUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="400px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <DateTile date={ev.date} size="sm" timeZone={EVENT_TZ} />
                      </div>
                    </div>
                    <div className="p-4">
                      <h2 className="font-bold text-[var(--text)] leading-tight line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
                        {ev.name}
                      </h2>
                      {ev.description ? (
                        <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
                          {ev.description}
                        </p>
                      ) : null}
                      <div className="mt-2 text-xs text-[var(--text-muted)] space-y-0.5">
                        <p>🗓️ {when(ev)}</p>
                        {ev.location ? <p>📍 {ev.location}</p> : null}
                        <p>
                          👥 {ev.attendeeCount} {ev.attendeeCount === 1 ? "apuntado" : "apuntados"}
                          {ev.gameCount > 0
                            ? ` · 🎲 ${ev.gameCount} ${ev.gameCount === 1 ? "juego" : "juegos"}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 text-center">
            <Link
              href={`/login?redirect=${encodeURIComponent("/events/new")}`}
              className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Organiza tu evento
            </Link>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Gratis y sin contraseñas.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
