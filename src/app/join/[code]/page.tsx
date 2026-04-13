"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = fetch("/api/profile", { credentials: "include" }).then(
      (r) => r.ok
    );
    const resolveInvite = fetch(`/api/join/${code}`).then(async (r) => {
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Enlace no válido");
      }
      return r.json();
    });

    Promise.all([checkAuth, resolveInvite])
      .then(([loggedIn, data]) => {
        setIsLoggedIn(loggedIn);
        setGroupName(data.groupName);
        setMemberCount(data.memberCount);
        setGroupId(data.groupId);
        if (data.alreadyMember) setAlreadyMember(true);
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
      const res = await fetch(`/api/join/${code}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al unirse");
      }

      if (data.alreadyMember) {
        router.push(`/groups/${data.groupId}`);
        return;
      }

      setJoined(true);
      setGroupId(data.groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
  };

  const handleLogin = () => {
    router.push(`/login?redirect=/join/${code}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
        Cargando...
      </div>
    );
  }

  if (error && !groupName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2.5 bg-[var(--surface-hover)] text-[var(--text)] rounded-xl hover:bg-[var(--surface-hover)] text-sm transition-all duration-200"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block mb-4"><AnimatedLogo /></Link>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
            <div className="text-4xl mb-3">👋</div>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-2">
              ¡Ya formas parte de &ldquo;{groupName}&rdquo;!
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              No hace falta que te unas de nuevo, tu grupo te espera.
            </p>
            <button
              onClick={() => router.push(`/groups/${groupId}`)}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Ir a &ldquo;{groupName}&rdquo;
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
              ¡Te has unido a &ldquo;{groupName}&rdquo;!
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Ya puedes votar juegos y participar en sesiones.
            </p>
            <button
              onClick={() => router.push(`/groups/${groupId}`)}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Ir al grupo
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
            Te han invitado a unirte a
          </h2>
          <p className="text-2xl font-bold text-[var(--primary)] mb-1">
            &ldquo;{groupName}&rdquo;
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
          </p>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          {isLoggedIn ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {joining ? "Uniéndote..." : "Unirme al grupo"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Necesitas iniciar sesión para unirte al grupo.
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
