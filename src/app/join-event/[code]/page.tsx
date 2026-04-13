"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import PageLoader from "@/components/PageLoader";

export default function JoinEventPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [alreadyAttending, setAlreadyAttending] = useState(false);
  const [eventId, setEventId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = fetch("/api/profile", { credentials: "include" }).then((r) => r.ok);
    const resolveInvite = fetch(`/api/join-event/${code}`).then(async (r) => {
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Enlace no válido");
      }
      return r.json();
    });

    Promise.all([checkAuth, resolveInvite])
      .then(([loggedIn, data]) => {
        setIsLoggedIn(loggedIn);
        setEventName(data.eventName);
        setEventDate(data.eventDate);
        setEventLocation(data.eventLocation);
        setAttendeeCount(data.attendeeCount);
        setGameCount(data.gameCount);
        setEventId(data.eventId);
        if (data.alreadyAttending) setAlreadyAttending(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error inesperado");
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/join-event/${code}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al apuntarse");
      }

      if (data.alreadyAttending) {
        router.push(`/events/${data.eventId}`);
        return;
      }

      setJoined(true);
      setEventId(data.eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
  };

  const handleLogin = () => {
    router.push(`/login?redirect=/join-event/${code}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>;
  }

  if (error && !eventName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2.5 bg-[var(--surface-hover)] text-[var(--text)] rounded-xl text-sm transition-all duration-200"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyAttending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <div className="text-4xl mb-3">👋</div>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-2">
              ¡Ya estás apuntado a &ldquo;{eventName}&rdquo;!
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              No hace falta que te apuntes de nuevo.
            </p>
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Ir al evento
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-2">
              ¡Te has apuntado a &ldquo;{eventName}&rdquo;!
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Ya puedes marcar tus juegos favoritos y montar tu lista.
            </p>
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Ir al evento
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
          <div className="text-4xl mb-3">🎲</div>
          <h2 className="text-lg font-semibold text-[var(--text)] mb-2">
            Te han invitado a un evento
          </h2>
          <p className="text-2xl font-bold text-[var(--primary)] mb-2">
            &ldquo;{eventName}&rdquo;
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {eventDate && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)]">
                {formatDate(eventDate)}
              </span>
            )}
            {eventLocation && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                {eventLocation}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {attendeeCount} asistente{attendeeCount !== 1 ? "s" : ""} · {gameCount} juego{gameCount !== 1 ? "s" : ""}
          </p>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          {isLoggedIn ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {joining ? "Apuntándote..." : "Apuntarme al evento"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Necesitas iniciar sesión para apuntarte al evento.
              </p>
              <button
                onClick={handleLogin}
                className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Iniciar sesión / Crear cuenta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
