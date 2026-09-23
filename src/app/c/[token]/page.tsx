import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import {
  countOwnedGames,
  findCollectionOwner,
  loadCollection,
} from "@/lib/collectionData";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import CollectionBrowser from "@/components/CollectionBrowser";

// Depende de quién mire y de datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const owner = await findCollectionOwner(token);

  // Un enlace revocado no cuenta nada de nadie.
  if (!owner?.bggUsername) {
    return {
      title: "Colección compartida · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  const name = owner.displayName || owner.name || `@${owner.bggUsername}`;
  const { games, expansions } = await countOwnedGames(owner.bggUsername);

  const title = `La colección de juegos de ${name}`;
  const description =
    games > 0
      ? `${plural(games, "juego", "juegos")}${
          expansions > 0 ? ` y ${plural(expansions, "expansión", "expansiones")}` : ""
        } en la estantería de ${name}, con sus partidas y sus notas.`
      : `La estantería de ${name} en BG Planner.`;

  return {
    title,
    description,
    // El enlace se comparte por privado; que no acabe en un buscador.
    robots: { index: false, follow: false },
    // La imagen la pinta opengraph-image.tsx y Next la enlaza sola.
    openGraph: {
      type: "website",
      siteName: "BG Planner",
      locale: "es_ES",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function Aviso({
  titulo,
  texto,
  accion,
  href,
}: {
  titulo: string;
  texto: string;
  accion: string;
  href: string;
}) {
  return (
    <>
      <SmartNav />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-xl mx-auto bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-[var(--text)] mb-2">{titulo}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">{texto}</p>
          <Link
            href={href}
            className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
          >
            {accion}
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default async function SharedCollectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Página pública: quien tenga el enlace la abre sin cuenta. Lo único que
  // la protege es que el token no se puede adivinar, y el dueño puede
  // revocarlo cuando quiera. La sesión solo sirve para saber si quien mira
  // es el propio dueño.
  const session = await getSession();
  const owner = await findCollectionOwner(token);

  if (!owner || !owner.bggUsername) {
    return (
      <Aviso
        titulo="Este enlace ya no funciona"
        texto="Puede que su dueño haya dejado de compartir la colección o haya generado un enlace nuevo. Pídeselo otra vez."
        accion={session ? "Ir a mi colección" : "Conocer BG Planner"}
        href={session ? "/collection" : "/"}
      />
    );
  }

  const { items, fetchedAt } = await loadCollection(owner.id, owner.bggUsername);
  const ownerName = owner.displayName || owner.name || `@${owner.bggUsername}`;
  const isSelf = owner.id === session?.userId;

  // Las notas privadas no se comparten aunque el resto sí.
  const shared = items.map((item) => ({ ...item, note: null }));

  return (
    <>
      <SmartNav />
      <div className="min-h-screen bg-[var(--bg)] py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Colección compartida
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">
              La colección de {ownerName}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {isSelf
                ? "Esto es lo que ve quien abra tu enlace. Aquí no se puede puntuar."
                : `Puedes mirar y filtrar, pero las puntuaciones son de ${ownerName} y solo ${ownerName} puede cambiarlas.`}
            </p>
          </div>

          {!session && (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
              Esto es una colección compartida desde{" "}
              <Link href="/" className="text-[var(--primary)] hover:underline">
                BG Planner
              </Link>
              , donde los grupos de amigos deciden a qué jugar.{" "}
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                Entra
              </Link>{" "}
              para montar la tuya.
            </div>
          )}

          <Suspense fallback={<div className="py-16" />}>
            <CollectionBrowser
              items={shared}
              readOnly
              owner={ownerName}
              fetchedAt={fetchedAt ? fetchedAt.toISOString() : null}
            />
          </Suspense>
        </div>
      </div>
      <Footer />
    </>
  );
}
