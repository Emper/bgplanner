import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCommunityTag } from "@/lib/community";
import { excerpt } from "@/lib/text";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// La ficha del hilo se pinta en el cliente; esto le da a cada uno su título,
// su descripción y sus datos estructurados para buscadores y vistas previas.
const getThreadMeta = cache((id: string) =>
  prisma.communityThread.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      tag: true,
      createdAt: true,
      editedAt: true,
      author: { select: { name: true, displayName: true } },
      _count: { select: { replies: { where: { deletedAt: null } } } },
    },
  })
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThreadMeta(id).catch(() => null);
  if (!thread) {
    return {
      title: "Conversación no encontrada · BG Planner",
      robots: { index: false, follow: false },
    };
  }
  const tag = getCommunityTag(thread.tag);
  const title = `${thread.title} · ${tag.label} · Comunidad BG Planner`;
  const description = excerpt(thread.body, 160);
  const url = `${APP_URL}/community/${thread.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: thread.title, description, url, type: "article", siteName: "BG Planner", locale: "es_ES" },
    twitter: { card: "summary", title: thread.title, description },
  };
}

// schema.org/DiscussionForumPosting: así Google sabe que es un hilo de foro
// (autor, fecha y cuántas respuestas tiene).
function threadJsonLd(thread: NonNullable<Awaited<ReturnType<typeof getThreadMeta>>>) {
  const url = `${APP_URL}/community/${thread.id}`;
  const authorName = thread.author.displayName || thread.author.name || "Jugador";
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    text: excerpt(thread.body, 1000),
    url,
    datePublished: thread.createdAt.toISOString(),
    ...(thread.editedAt ? { dateModified: thread.editedAt.toISOString() } : {}),
    // Sin la URL del perfil: no los empujamos a buscadores (BACKLOG.md, punto 5).
    author: { "@type": "Person", name: authorName },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: thread._count.replies,
    },
    inLanguage: "es-ES",
  };
}

export default async function CommunityThreadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getThreadMeta(id).catch(() => null);
  return (
    <>
      {thread && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(threadJsonLd(thread)).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {children}
    </>
  );
}
