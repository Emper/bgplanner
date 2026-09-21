import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadCollection } from "@/lib/collectionData";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CollectionBrowser from "@/components/CollectionBrowser";

// El enlace se comparte por privado; que no acabe en un buscador.
export const metadata: Metadata = {
  title: "Colección compartida · BG Planner",
  robots: { index: false, follow: false },
};

// Depende de quién mire y de datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-xl mx-auto bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-[var(--text)] mb-2">{titulo}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">{texto}</p>
          <Link
            href="/collection"
            className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
          >
            Ir a mi colección
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
  // El middleware ya exige sesión para /c/*; esto es el segundo cerrojo,
  // porque aquí se enseña qué juegos quiere vender alguien.
  const session = await getSession();
  if (!session) {
    return (
      <Aviso
        titulo="Necesitas iniciar sesión"
        texto="Esta colección se comparte solo con usuarios de BG Planner. Entra con tu cuenta y vuelve a abrir el enlace."
      />
    );
  }

  const { token } = await params;
  const owner = await prisma.user.findUnique({
    where: { collectionShareToken: token },
    select: { id: true, name: true, displayName: true, bggUsername: true },
  });

  if (!owner || !owner.bggUsername) {
    return (
      <Aviso
        titulo="Este enlace ya no funciona"
        texto="Puede que su dueño haya dejado de compartir la colección o haya generado un enlace nuevo. Pídeselo otra vez."
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
