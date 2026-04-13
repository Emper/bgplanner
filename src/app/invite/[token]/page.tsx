"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = fetch("/api/profile", { credentials: "include" }).then((r) => r.ok);
    const resolveInvite = fetch(`/api/invite/${token}`).then(async (r) => {
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Invitación no válida");
      }
      return r.json();
    });

    Promise.all([checkAuth, resolveInvite])
      .then(([loggedIn, data]) => {
        setIsLoggedIn(loggedIn);
        setGroupName(data.groupName);
        setMemberCount(data.memberCount);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error inesperado");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al unirse");
      }

      router.push(`/groups/${data.groupId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
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
              className="px-4 py-2.5 bg-[var(--surface-hover)] text-[var(--text)] rounded-xl text-sm transition-all duration-200"
            >
              Ir al inicio
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
                onClick={() => router.push(`/login?redirect=/invite/${token}`)}
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
