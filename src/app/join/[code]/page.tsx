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
      nudgePush("group");
    } catch (err) {
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

  if (alreadyMember) {
    return (
      <InviteScreen>
        <Notice
          icon="👋"
          title={<>¡Ya formas parte de &ldquo;{groupName}&rdquo;!</>}
          actions={
            <ButtonLink href={`/groups/${groupId}`} block>
              Ir a &ldquo;{groupName}&rdquo;
            </ButtonLink>
          }
        >
          <p>No hace falta que te unas de nuevo, tu grupo te espera.</p>
        </Notice>
      </InviteScreen>
    );
  }

  if (joined) {
    return (
      <InviteScreen>
        <Notice
          icon="🎉"
          title={<>¡Te has unido a &ldquo;{groupName}&rdquo;!</>}
          actions={
            <ButtonLink href={`/groups/${groupId}`} block>
              Ir al grupo
            </ButtonLink>
          }
        >
          <p>Ya puedes votar juegos y participar en sesiones.</p>
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
            <ButtonLink href={loginHref(`/join/${code}`)} block>
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
