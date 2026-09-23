import Link from "next/link";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadCollection } from "@/lib/collectionData";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CollectionBrowser from "@/components/CollectionBrowser";

// Depende de quién mire y de datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

// `cache` de React: generateMetadata y la página corren en la misma
// petición, y así el dueño se busca una sola vez.
const findOwner = cache(async (token: string) =>
  prisma.user.findUnique({
    where: { collectionShareToken: token },
    select: { id: true, name: true, displayName: true, bggUsername: true },
  })
);

// Para la tarjeta del enlace: la portada de un juego de verdad dice mucho
// más que el logo. Primero uno de la vitrina; si no tiene, el mejor
// colocado en el ranking de BGG.
async function pickCover(userId: string, bggUsername: string) {
  const showcased = await prisma.collectionEntry.findFirst({
    where: { userId, showcased: true },
    select: { bggId: true },
  });

  const game = await prisma.collectionGame.findFirst({
    where: {
      bggUsername,
      image: { not: null },
      ...(showcased ? { bggId: showcased.bggId } : { status: "own", subtype: "boardgame" }),
    },
    select: { image: true },
    orderBy: { bggRank: { sort: "asc", nulls: "last" } },
  });

  return game?.image ?? null;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const owner = await findOwner(token);

  // Un enlace revocado no cuenta nada de nadie.
  if (!owner?.bggUsername) {
    return {
      title: "Colección compartida · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  const name = owner.displayName || owner.name || `@${owner.bggUsername}`;
  const bggUsername = owner.bggUsername.toLowerCase().trim();

  const [games, expansions, cover] = await Promise.all([
    prisma.collectionGame.count({
      where: { bggUsername, status: "own", subtype: "boardgame" },
    }),
    prisma.collectionGame.count({
      where: { bggUsername, status: "own", subtype: "boardgameexpansion" },
    }),
    pickCover(owner.id, bggUsername),
  ]);

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
    openGraph: {
      type: "website",
      siteName: "BG Planner",
      locale: "es_ES",
      title,
      description,
      ...(cover ? { images: [{ url: cover, alt: title }] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
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
      <Navbar />
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

  // La colección solo se enseña a usuarios de BG Planner. La página sí
  // responde sin sesión (con este aviso) para que las tarjetas de enlace de
  // WhatsApp y compañía puedan leer el título; los juegos no salen de aquí.
  const session = await getSession();
  if (!session) {
    return (
      <Aviso
        titulo="Necesitas iniciar sesión"
        texto="Esta colección se comparte solo con usuarios de BG Planner. Entra con tu cuenta y te traemos de vuelta aquí."
        accion="Iniciar sesión"
        href={`/login?redirect=${encodeURIComponent(`/c/${token}`)}`}
      />
    );
  }

  const owner = await findOwner(token);

  if (!owner || !owner.bggUsername) {
    return (
      <Aviso
        titulo="Este enlace ya no funciona"
        texto="Puede que su dueño haya dejado de compartir la colección o haya generado un enlace nuevo. Pídeselo otra vez."
        accion="Ir a mi colección"
        href="/collection"
      />
    );
  }

  const { items, fetchedAt } = await loadCollection(owner.id, owner.bggUsername);
  const ownerName = owner.displayName || owner.name || `@${owner.bggUsername}`;
  const isSelf = owner.id === session.userId;

  // Las notas privadas no se comparten aunque el resto sí.
  const shared = items.map((item) => ({ ...item, note: null }));

  return (
    <>
      <Navbar />
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
