import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { findSharedList, type SharedList } from "@/lib/sharedList";
import { formatEventWhen } from "@/lib/publicLinks";
import { INTENSITY_COLORS, INTENSITY_LABELS } from "@/lib/intensity";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import SignupBanner from "@/components/SignupBanner";

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
  return (
    <li className="flex items-center gap-3 py-2.5">
      {played && (
        <span className="w-6 h-6 shrink-0 rounded-md bg-emerald-500 text-white flex items-center justify-center" aria-label="Jugado">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
      <div className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)] ${played ? "opacity-60" : ""}`}>
        {item.game.thumbnail ? (
          <Image src={item.game.thumbnail} alt={item.game.name} width={40} height={40} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <a
          href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-semibold text-sm sm:text-base hover:text-[var(--primary)] transition-colors ${
            played ? "text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]" : "text-[var(--text)]"
          }`}
        >
          {item.game.name}
        </a>
        <span
          className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border ${INTENSITY_COLORS[item.intensity]} ${played ? "opacity-60" : ""}`}
        >
          {item.intensity}. {INTENSITY_LABELS[item.intensity]}
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
      <>
        <SmartNav />
        <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
          <div className="max-w-xl mx-auto bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-8 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">Este enlace ya no funciona</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Puede que su dueño haya dejado de compartir la lista o haya generado un enlace nuevo. Pídeselo otra vez.
            </p>
            <Link
              href={session ? "/events" : "/"}
              className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
            >
              {session ? "Ir a mis eventos" : "Conocer BG Planner"}
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const isSelf = list.ownerId === session?.userId;
  const empty = list.pending.length === 0 && list.played.length === 0;

  return (
    <>
      <SmartNav />
      <div className="min-h-screen bg-[var(--bg)] py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Lista compartida</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">La lista de {list.ownerName}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
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
          </div>

          {!session && (
            <SignupBanner variant="event" redirect={`/l/${encodeURIComponent(token)}`} />
          )}

          {empty ? (
            <p className="text-[var(--text-secondary)] text-center py-8">Todavía no hay juegos en esta lista.</p>
          ) : (
            <div className="space-y-6">
              {list.pending.length > 0 ? (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 sm:px-4 py-1">
                  <ul className="divide-y divide-[var(--border)]">
                    {list.pending.map((item) => <Row key={item.id} item={item} played={false} />)}
                  </ul>
                </div>
              ) : (
                <p className="text-[var(--text-secondary)] text-center py-6">¡Ya lo ha jugado todo! 🎉</p>
              )}

              {list.played.length > 0 && (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 sm:px-4 py-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
                    Jugados ({list.played.length})
                  </h2>
                  <ul className="divide-y divide-[var(--border)]">
                    {list.played.map((item) => <Row key={item.id} item={item} played />)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
