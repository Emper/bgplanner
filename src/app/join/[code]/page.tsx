"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // 1. Check auth status & resolve invite code in parallel
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
        // Already a member, go directly to the group
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
    router.push(`/?redirect=/join/${code}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-500">
        Cargando...
      </div>
    );
  }

  if (error && !groupName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-amber-400 mb-4">WeBoard</h1>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-sm"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-amber-400 mb-4">WeBoard</h1>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-lg font-semibold text-slate-100 mb-2">
              ¡Te has unido a &ldquo;{groupName}&rdquo;!
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Ya puedes votar juegos y participar en sesiones.
            </p>
            <button
              onClick={() => router.push(`/groups/${groupId}`)}
              className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium"
            >
              Ir al grupo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-amber-400 mb-4">WeBoard</h1>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="text-4xl mb-3">🎲</div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Te han invitado a unirte a
          </h2>
          <p className="text-2xl font-bold text-amber-400 mb-1">
            &ldquo;{groupName}&rdquo;
          </p>
          <p className="text-sm text-slate-500 mb-6">
            {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
          </p>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          {isLoggedIn ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
            >
              {joining ? "Uniéndote..." : "Unirme al grupo"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Necesitas iniciar sesión para unirte al grupo.
              </p>
              <button
                onClick={handleLogin}
                className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium"
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
