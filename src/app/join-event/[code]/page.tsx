"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import PageLoader from "@/components/PageLoader";
import Button, { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/EmptyState";
import { FieldError } from "@/components/ui/Field";
import { formatDateLong } from "@/lib/format";
import { nudgePush } from "@/lib/pushNudge";
import { loginHref } from "@/lib/site";
import { plural } from "@/lib/text";

/** Pantalla completa sin cabecera: el logo y el aviso centrados. */
function InviteScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
        {children}
      </div>
    </main>
  );
}

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
      nudgePush("event");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <PageLoader fullScreen />;
  }

  if (error && !eventName) {
    return (
      <InviteScreen>
        <Notice
          icon="🔗"
          title={error}
          actions={<ButtonLink href="/" variant="secondary">Ir al inicio</ButtonLink>}
        />
      </InviteScreen>
    );
  }

  if (alreadyAttending) {
    return (
      <InviteScreen>
        <Notice
          icon="👋"
          title={<>¡Ya estás apuntado a &ldquo;{eventName}&rdquo;!</>}
          actions={
            <ButtonLink href={`/events/${eventId}`} block>
              Ir al evento
            </ButtonLink>
          }
        >
          <p>No hace falta que te apuntes de nuevo.</p>
        </Notice>
      </InviteScreen>
    );
  }

  if (joined) {
    return (
      <InviteScreen>
        <Notice
          icon="🎉"
          title={<>¡Te has apuntado a &ldquo;{eventName}&rdquo;!</>}
          actions={
            <ButtonLink href={`/events/${eventId}`} block>
              Ir al evento
            </ButtonLink>
          }
        >
          <p>Ya puedes marcar tus juegos favoritos y montar tu lista.</p>
        </Notice>
      </InviteScreen>
    );
  }

  return (
    <InviteScreen>
      <Notice
        icon="🎲"
        title={
          <>
            Te han invitado a un evento
            <span className="block mt-2 text-2xl font-bold text-[var(--primary)]">
              &ldquo;{eventName}&rdquo;
            </span>
          </>
        }
        actions={
          isLoggedIn ? (
            <Button onClick={handleJoin} loading={joining} block>
              {joining ? "Apuntándote…" : "Apuntarme al evento"}
            </Button>
          ) : (
            <ButtonLink href={loginHref(`/join-event/${code}`)} block>
              Iniciar sesión / Crear cuenta
            </ButtonLink>
          )
        }
      >
        {(eventDate || eventLocation) && (
          <div className="flex flex-wrap justify-center gap-2">
            {eventDate && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)]">
                {formatDateLong(eventDate)}
              </span>
            )}
            {eventLocation && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                {eventLocation}
              </span>
            )}
          </div>
        )}
        <p className="text-[var(--text-muted)]">
          {plural(attendeeCount, "asistente", "asistentes")} · {plural(gameCount, "juego", "juegos")}
        </p>
        <FieldError>{error}</FieldError>
        {!isLoggedIn && <p>Necesitas iniciar sesión para apuntarte al evento.</p>}
      </Notice>
    </InviteScreen>
  );
}
