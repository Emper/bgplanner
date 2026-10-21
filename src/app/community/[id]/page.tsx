import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getSession, isSuperadmin } from "@/lib/auth";
import { getCommunityTag } from "@/lib/community";
import { getLikedReplyIds, getThreadDetail } from "@/lib/communityServer";
import { getBlockedIds } from "@/lib/moderation";
import { excerpt } from "@/lib/text";
import { jsonLdHtml } from "@/lib/html";
import { APP_URL } from "@/lib/site";
import SmartNav from "@/components/SmartNav";
import SignupBanner from "@/components/SignupBanner";
import PageShell from "@/components/ui/PageShell";
import ThreadClient, { type ThreadInitial } from "./ThreadClient";

// El hilo y sus respuestas salen pintados del servidor: se leen sin cuenta y
// los encuentran los buscadores. Lo interactivo vive en ThreadClient.
export const dynamic = "force-dynamic";

// Una sola consulta para los metadatos y la página.
const getThreadMeta = cache((id: string) => getThreadDetail(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getThreadMeta(id).catch(() => null);
  if (!detail) {
    return {
      title: "Conversación no encontrada · BG Planner",
      robots: { index: false, follow: false },
    };
  }
  const t = detail.thread;
  const tag = getCommunityTag(t.tag);
  const title = `${t.title} · ${tag.label} · Comunidad BG Planner`;
  const description = excerpt(t.body, 160);
  const url = `${APP_URL}/community/${t.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: t.title, description, url, type: "article", siteName: "BG Planner", locale: "es_ES" },
    twitter: { card: "summary", title: t.title, description },
  };
}

// schema.org/DiscussionForumPosting: así Google sabe que es un hilo de foro
// (autor, fecha, respuestas).
function threadJsonLd({ thread, replies }: ThreadInitial) {
  const url = `${APP_URL}/community/${thread.id}`;
  const live = replies.filter((r) => !r.deleted);
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    text: excerpt(thread.body, 1000),
    url,
    datePublished: thread.createdAt,
    ...(thread.editedAt ? { dateModified: thread.editedAt } : {}),
    // Sin la URL del perfil: no los empujamos a buscadores (BACKLOG.md, punto 5).
    author: { "@type": "Person", name: thread.author.name },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: live.length,
    },
    // Las respuestas también cuentan para Google como parte de la conversación.
    comment: live.slice(0, 50).map((r) => ({
      "@type": "Comment",
      text: excerpt(r.body, 500),
      datePublished: r.createdAt,
      author: { "@type": "Person", name: r.author.name },
      ...(r.likes > 0
        ? {
            interactionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/LikeAction",
              userInteractionCount: r.likes,
            },
          }
        : {}),
    })),
    inLanguage: "es-ES",
  };
}

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, session] = await Promise.all([getThreadMeta(id).catch(() => null), getSession()]);
  if (!detail) notFound();
  const [isAdmin, blockedIds, likedIds] = await Promise.all([
    isSuperadmin(session),
    getBlockedIds(session?.userId),
    getLikedReplyIds(session?.userId, id),
  ]);
  // Fechas a texto, igual que llegarían por la API.
  const initial = JSON.parse(JSON.stringify(detail)) as ThreadInitial;

  return (
    <PageShell nav={<SmartNav />} width="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(threadJsonLd(initial)) }} />
      <ThreadClient
        initial={initial}
        viewerId={session?.userId ?? null}
        isAdmin={isAdmin}
        initialBlockedIds={blockedIds}
        initialLikedIds={likedIds}
        banner={!session && <SignupBanner variant="community" redirect={`/community/${id}`} />}
      />
    </PageShell>
  );
}
