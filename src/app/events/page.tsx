"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

interface EventData {
  id: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  visibility: string;
  createdById: string;
  createdBy: { name: string | null; email: string };
  _count: { attendees: number; games: number };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.date) >= now);
  const past = events.filter((e) => new Date(e.date) < now);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Navbar />
      <div className="max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Eventos</h1>
          <Link
            href="/events/new"
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Crear evento
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-12">Cargando...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg mb-2">No hay eventos todavía</p>
            <p className="text-slate-500 text-sm">Crea el primero para organizar tu próxima jornada de juegos</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Próximos eventos ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Eventos pasados ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventData }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-100 text-lg leading-tight">{event.name}</h3>
          {event.description && (
            <p className="text-slate-400 text-sm mt-1 line-clamp-2">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
              {formatDate(event.date)}
              {event.endDate && ` – ${formatDate(event.endDate)}`}
            </span>
            {event.location && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
              {event._count.attendees} asistente{event._count.attendees !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
              {event._count.games} juego{event._count.games !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="text-slate-500 text-2xl shrink-0">›</div>
      </div>
    </Link>
  );
}
