"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import PageLoader from "@/components/PageLoader";
import Button, { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/EmptyState";
import { FieldError } from "@/components/ui/Field";
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
    let cancelled = false;

    // Reintentamos ante fallos de red o 5xx (cold starts de Prisma en Vercel,
    // red móvil inestable…): pequeña espera exponencial y máximo 3 intentos.
    const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
      let lastErr: unknown;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
      }
      throw lastErr;
    };

    const checkAuth = withRetry(() =>
      fetch("/api/profile", { credentials: "include" }).then((r) => r.ok)
    );

    const resolveInvite = withRetry(async () => {
      const r = await fetch(`/api/invite/${token}`);
      if (r.status >= 500) throw new Error("Servidor no disponible");
      if (!r.ok) {
        // 4xx son definitivos (invitación no válida / caducada); no reintentamos.
        const data = await r.json().catch(() => ({}));
        const err = new Error(data.error || "Invitación no válida") as Error & {
          fatal?: boolean;
        };
        err.fatal = true;
        throw err;
      }
      return r.json();
    }, 3).catch((err) => {
      // Propagamos 4xx sin más; el resto se reintentó ya arriba.
      throw err;
    });

    Promise.all([checkAuth, resolveInvite])
      .then(([loggedIn, data]) => {
        if (cancelled) return;
        setIsLoggedIn(loggedIn);
        setGroupName(data.groupName);
        setMemberCount(data.memberCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
      nudgePush("group");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <PageLoader fullScreen />;
  }

  if (error && !groupName) {
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

  return (
    <InviteScreen>
      <Notice
        icon="🎲"
        title={
          <>
            Te han invitado a unirte a
            <span className="block mt-2 text-2xl font-bold text-[var(--primary)]">
              &ldquo;{groupName}&rdquo;
            </span>
          </>
        }
        actions={
          isLoggedIn ? (
            <Button onClick={handleJoin} loading={joining} block>
              {joining ? "Uniéndote…" : "Unirme al grupo"}
            </Button>
          ) : (
            <ButtonLink href={loginHref(`/invite/${token}`)} block>
              Iniciar sesión / Crear cuenta
            </ButtonLink>
          )
        }
      >
        <p className="text-[var(--text-muted)]">{plural(memberCount, "miembro", "miembros")}</p>
        <FieldError>{error}</FieldError>
        {!isLoggedIn && <p>Necesitas iniciar sesión para unirte al grupo.</p>}
      </Notice>
    </InviteScreen>
  );
}
