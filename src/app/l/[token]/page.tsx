import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { findSharedList, type SharedList } from "@/lib/sharedList";
import { formatEventWhen } from "@/lib/publicLinks";
import { INTENSITY_COLORS, intensityText, isVeto } from "@/lib/intensity";
import { bggGameUrl } from "@/lib/bggLinks";
import SmartNav from "@/components/SmartNav";
import SignupBanner from "@/components/SignupBanner";
import PageShell from "@/components/ui/PageShell";
import { BackLink } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/EmptyState";
import { cardClass } from "@/components/ui/Card";
import GameThumb from "@/components/ui/GameThumb";

// Depende de quién mire y de datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const list = await findSharedList(token);

  // Un enlace revocado no cuenta nada de nadie.
  if (!list) {
    return {
      title: "Lista compartida · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  // De un evento privado no se cuenta el nombre fuera de la app: la vista
  // previa del enlace se queda en quién comparte.
  const title = list.event.isPublic
    ? `La lista de ${list.ownerName} para ${list.event.name}`
    : `La lista de juegos de ${list.ownerName}`;
  const total = list.pending.length + list.played.length;
  const description = `${total} ${total === 1 ? "juego" : "juegos"} que quiere jugar, de más a menos ganas.`;

  return {
    title,
    description,
    // El enlace se comparte por privado; que no acabe en un buscador.
    robots: { index: false, follow: false },
    openGraph: { type: "website", siteName: "BG Planner", locale: "es_ES", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Row({ item, played }: { item: SharedList["pending"][number]; played: boolean }) {
  const struck = played || isVeto(item.intensity);
  return (
    <li className="flex items-center gap-3 py-2.5">
      {played && (
        <span className="w-6 h-6 shrink-0 rounded-md bg-emerald-500 text-white flex items-center justify-center" aria-label="Jugado">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
      <GameThumb
        src={item.game.thumbnail}
        name={item.game.name}
        size="sm"
        fit="contain"
        className={`${struck ? "opacity-60" : ""} ${isVeto(item.intensity) ? "grayscale" : ""}`}
      />
      <div className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <a
          href={bggGameUrl(item.game.bggId)}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-semibold text-sm sm:text-base hover:text-[var(--primary)] transition-colors ${
            struck ? "text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]" : "text-[var(--text)]"
          }`}
        >
          {item.game.name}
        </a>
        <span
          className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border ${INTENSITY_COLORS[item.intensity]} ${played ? "opacity-60" : ""}`}
        >
          {intensityText(item.intensity)}
        </span>
      </div>
    </li>
  );
}

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Página pública: la abre quien tenga el enlace, con o sin cuenta. La
  // protege que el token no se puede adivinar y que su dueño puede
  // revocarlo. La sesión solo sirve para saber si quien mira es el dueño.
  const session = await getSession();
  const list = await findSharedList(token);

  if (!list) {
    return (
      <PageShell nav={<SmartNav />} width="form">
        <Notice
          icon="🔒"
          title="Este enlace ya no funciona"
          actions={
            <ButtonLink href={session ? "/events" : "/"} size="lg">
              {session ? "Ir a mis eventos" : "Conocer BG Planner"}
            </ButtonLink>
          }
        >
          <p>
            Puede que su dueño haya dejado de compartir la lista o haya generado un enlace nuevo. Pídeselo otra vez.
          </p>
        </Notice>
      </PageShell>
    );
  }

  const isSelf = list.ownerId === session?.userId;
  const empty = list.pending.length === 0 && list.played.length === 0 && list.vetoed.length === 0;

  return (
    <PageShell nav={<SmartNav />} width="main">
      <header className="mb-6">
        <BackLink href={`/events/${list.event.id}`} className="mb-3">
          {list.event.name}
        </BackLink>
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Lista compartida</p>
        <h1 className="page-title">La lista de {list.ownerName}</h1>
        <p className="page-lead mt-1">
          Para{" "}
          <Link href={`/events/${list.event.id}`} className="font-semibold text-[var(--text)] hover:text-[var(--primary)] transition-colors">
            {list.event.name}
          </Link>
          {" · "}
          {formatEventWhen(list.event.date.toISOString())}
          {list.event.location ? ` · ${list.event.location}` : ""}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {isSelf
            ? "Esto es lo que ve quien abra tu enlace. Tus notas no salen aquí."
            : `Lo que ${list.ownerName} quiere jugar, de más a menos ganas.`}
        </p>
      </header>

      {!session && (
        <SignupBanner variant="event" redirect={`/l/${encodeURIComponent(token)}`} />
      )}

      {empty ? (
        <EmptyState title="Todavía no hay juegos en esta lista" />
      ) : (
        <div className="space-y-6">
          {list.pending.length > 0 ? (
            <div className={cardClass({ padding: "none", className: "px-3 sm:px-4 py-1" })}>
              <ul className="divide-y divide-[var(--border)]">
                {list.pending.map((item) => <Row key={item.id} item={item} played={false} />)}
              </ul>
            </div>
          ) : list.played.length > 0 ? (
            <EmptyState title="¡Ya lo ha jugado todo! 🎉" />
          ) : null}

          {list.played.length > 0 && (
            <div className={cardClass({ padding: "none", className: "px-3 sm:px-4 py-2" })}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
                Jugados ({list.played.length})
              </h2>
              <ul className="divide-y divide-[var(--border)]">
                {list.played.map((item) => <Row key={item.id} item={item} played />)}
              </ul>
            </div>
          )}

          {list.vetoed.length > 0 && (
            <div className="bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)] px-3 sm:px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
                No quiere jugarlos ({list.vetoed.length})
              </h2>
              <ul className="divide-y divide-[var(--border)]">
                {list.vetoed.map((item) => <Row key={item.id} item={item} played={false} />)}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
