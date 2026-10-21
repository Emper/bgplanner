"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { formatDateShort } from "@/lib/format";
import { plural } from "@/lib/text";
import PageLoader from "@/components/PageLoader";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/Card";
import DateTile from "@/components/DateTile";
import { spotlightMove } from "@/components/motion";

interface EventData {
  id: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  imageUrl: string | null;
  visibility: string;
  createdById: string;
  createdBy: { name: string | null; displayName: string | null };
  _count: { attendees: number; games: number };
}

const formatDate = formatDateShort;

export default function EventsClient() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar eventos");
        return r.json();
      })
      .then((data) => setEvents(data))
      .catch(() => { /* silently fallback to empty */ })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.date) >= now);
  const past = events.filter((e) => new Date(e.date) < now);

  return (
    <PageShell nav={<Navbar />} width="main">
      <PageHeader
        title="Eventos"
        action={<ButtonLink href="/events/new">Crear evento</ButtonLink>}
      />

      {loading ? (
        <PageLoader withNavbar />
      ) : events.length === 0 ? (
        <EmptyState
          title="No hay eventos todavía"
          description="Crea el primero para organizar tu próxima jornada de juegos"
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-8">
              <SectionLabel>Próximos eventos ({upcoming.length})</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-4 fx-stagger">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <SectionLabel>Eventos pasados ({past.length})</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-4 fx-stagger">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} past />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

// El fin solo se enseña si cae otro día: «11 abr – 11 abr» no dice nada.
function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function EventCard({ event, past = false }: { event: EventData; past?: boolean }) {
  return (
    <Link
      href={`/events/${event.id}`}
      onPointerMove={spotlightMove}
      className={`fx-spotlight group flex flex-col h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 transition-all duration-200 shadow-[var(--card-shadow)] ${
        past ? "opacity-75 hover:opacity-100" : ""
      }`}
    >
      {/* Cartel. La foto va entera (los carteles suelen ser logos y recortarlos
          los destroza) y el hueco que sobre lo rellena ella misma, difuminada.
          Sin foto, el degradado con fichas de la portada. */}
      <div className="relative aspect-[16/10] overflow-hidden fx-event-art">
        {event.imageUrl ? (
          <>
            <Image
              src={event.imageUrl}
              alt=""
              aria-hidden
              fill
              unoptimized
              sizes="(min-width: 640px) 480px, 100vw"
              className="object-cover scale-125 blur-2xl opacity-70 saturate-150"
            />
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              unoptimized
              sizes="(min-width: 640px) 480px, 100vw"
              className={`object-contain transition-transform duration-500 group-hover:scale-[1.03] ${past ? "grayscale-[0.4]" : ""}`}
            />
          </>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-40 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" aria-hidden>
            🎲
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-4 flex items-start gap-4 flex-1">
        <div className="-mt-10 sm:-mt-12 relative">
          <DateTile date={event.date} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--text)] text-lg leading-tight group-hover:text-[var(--primary)] transition-colors">{event.name}</h3>
          {event.description && (
            <p className="text-[var(--text-secondary)] text-sm mt-1 line-clamp-2">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)]">
              {formatDate(event.date)}
              {event.endDate && !sameDay(event.date, event.endDate) && ` – ${formatDate(event.endDate)}`}
            </span>
            {event.location && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-300">
              {plural(event._count.attendees, "asistente", "asistentes")}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              {plural(event._count.games, "juego", "juegos")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
