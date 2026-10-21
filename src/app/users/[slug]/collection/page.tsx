import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getCollectionAccess, getProfileHeader } from "@/lib/publicProfile";
import {
  collectionForViewer,
  collectionTagline,
  loadCollection,
} from "@/lib/collectionData";
import { ensureBggCollection } from "@/lib/bgg";
import { APP_URL } from "@/lib/site";
import SmartNav from "@/components/SmartNav";
import CollectionBrowser from "@/components/CollectionBrowser";
import SignupBanner from "@/components/SignupBanner";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/EmptyState";
import { BackLink } from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";

// Depende de quién mire (sus amigos ven además la permanencia) y de datos
// vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const header = await getProfileHeader(slug);

  if (!header) {
    return {
      title: "Colección no encontrada · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  // Igual que en el perfil: quien llega por el id acaba en la del slug.
  if (decodeURIComponent(slug) !== header.slug) {
    redirect(`/users/${encodeURIComponent(header.slug)}/collection`);
  }

  const name = header.displayName;
  const title = `La colección de juegos de ${name}`;
  const description = collectionTagline({
    name,
    games: header.stats.games,
    expansions: header.stats.expansions,
  });

  return {
    title: `${title} · BG Planner`,
    description,
    alternates: {
      canonical: `${APP_URL}/users/${encodeURIComponent(header.slug)}/collection`,
    },
    // Son los datos de BGG otra vez: el que se indexa es el perfil.
    robots: { index: false, follow: true },
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

export default async function ProfileCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const owner = await getCollectionAccess(slug, session?.userId ?? null);
  if (!owner) notFound();

  const profileHref = `/users/${encodeURIComponent(owner.slug)}`;
  const name = owner.isSelf ? "Mi colección" : `La colección de ${owner.displayName}`;

  const back = (
    <BackLink href={profileHref}>
      {owner.isSelf ? "Mi perfil" : `Perfil de ${owner.displayName}`}
    </BackLink>
  );

  if (!owner.bggUsername) {
    return (
      <PageShell nav={<SmartNav />} width="form">
        <div className="mb-6">{back}</div>
        <Notice
          icon="🗄️"
          title="Estantería vacía"
          actions={owner.isSelf && <ButtonLink href="/profile">Conectar mi cuenta de BGG</ButtonLink>}
        >
          <p>
            {owner.isSelf
              ? "Conecta tu usuario de BoardGameGeek en tu perfil y tu colección aparecerá aquí."
              : `${owner.displayName} todavía no ha conectado su colección de BoardGameGeek.`}
          </p>
        </Notice>
      </PageShell>
    );
  }

  let collection = await loadCollection(owner.id, owner.bggUsername);
  // Nunca traída de BGG (quien conectó la cuenta y no ha vuelto a pasar por
  // su colección): se trae ahora una vez. Si BGG falla, estantería vacía.
  if (!collection.fetchedAt) {
    try {
      await ensureBggCollection(owner.bggUsername);
      collection = await loadCollection(owner.id, owner.bggUsername);
    } catch (error) {
      console.error("[Colección del perfil] BGG no disponible:", error);
    }
  }

  const items = collectionForViewer(collection.items, {
    showScores: owner.showScores,
  });

  return (
    <PageShell nav={<SmartNav />} width="wide">
      <header className="mb-6">
        {back}
        <h1 className="page-title mt-3">{name}</h1>
        <p className="page-lead mt-1">
          {owner.isSelf
            ? "Así la ven tus amigos. El resto la ve igual, pero sin la permanencia."
            : owner.showScores
              ? `Como sois amigos, ves también lo que ${owner.displayName} piensa quedarse y lo que dejaría ir.`
              : "Sus juegos y su wishlist de BoardGameGeek, con las partidas que lleva a cada uno."}
        </p>
        {owner.isSelf && (
          <Link
            href="/collection"
            className="inline-flex mt-3 text-sm text-[var(--primary)] hover:underline"
          >
            Puntuar y elegir mi vitrina en Mi colección →
          </Link>
        )}
      </header>

      {!session && (
        <SignupBanner
          variant="collection"
          name={owner.displayName}
          redirect={`${profileHref}/collection`}
        />
      )}

      <Suspense fallback={<div className="py-16" />}>
        <CollectionBrowser
          items={items}
          readOnly
          hideScores={!owner.showScores}
          owner={owner.isSelf ? undefined : owner.displayName}
          fetchedAt={
            collection.fetchedAt ? collection.fetchedAt.toISOString() : null
          }
        />
      </Suspense>
    </PageShell>
  );
}
