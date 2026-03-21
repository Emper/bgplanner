"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/groups", { credentials: "include" });
        if (res.ok) {
          setIsLoggedIn(true);
        } else if (res.status === 401) {
          // Not logged in, redirect to login with return URL
          router.push(`/?redirect=/invite/${token}`);
          return;
        }
      } catch {
        router.push(`/?redirect=/invite/${token}`);
        return;
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token, router]);

  const handleJoin = async () => {
    setError("");
    setJoining(true);

    try {
      // We need to find the group for this token.
      // The join endpoint expects groupId and token in body.
      // But we don't know groupId from the token alone.
      // Let's try a simple approach: call a dedicated endpoint or iterate.
      // Looking at the API, we need a way to resolve token -> groupId.
      // The simplest approach: try POST with the token to a resolve endpoint.
      // Since there's no dedicated resolve endpoint, let's use the invitation token
      // which contains the groupId implicitly via the database lookup.
      // We'll add a simple fetch to try joining - the API should handle token lookup.

      // Alternative: fetch all groups or use a dedicated route.
      // For now, let's assume there's a general join endpoint that accepts token.
      // We'll try to call the join endpoint with a placeholder and let the API resolve it.

      // Actually, let's use a simpler approach: make a GET to check the invitation,
      // then POST to join. Since we don't have a resolve endpoint,
      // let's pass the token in the body and have the client figure out the group.

      // Pragmatic approach: try the invite/accept pattern
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/groups/${data.groupId}`);
        return;
      }

      // If that doesn't exist, try a different approach:
      // Search through the response for groupId
      if (res.status === 404) {
        // Fallback: try to get invitation info via GET
        const getRes = await fetch(`/api/invite/${token}`, {
          credentials: "include",
        });

        if (getRes.ok) {
          const invitation = await getRes.json();
          const joinRes = await fetch(
            `/api/groups/${invitation.groupId}/join`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ token }),
            }
          );

          if (joinRes.ok) {
            router.push(`/groups/${invitation.groupId}`);
            return;
          }

          const joinData = await joinRes.json();
          throw new Error(joinData.error || "Error al unirse al grupo");
        }
      }

      const data = await res.json();
      throw new Error(data.error || "Invitación inválida o expirada");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-500">
        Cargando...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-500">
        Redirigiendo al inicio de sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.svg" alt="WeBoard" width={200} height={48} priority className="mx-auto" />
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Invitación de grupo
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Has sido invitado a unirte a un grupo en WeBoard.
          </p>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
          >
            {joining ? "Uniéndose..." : "Unirme al grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}
