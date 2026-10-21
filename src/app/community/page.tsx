import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getCommunityTag, isCommunityTag } from "@/lib/community";
import { listThreads } from "@/lib/communityServer";
import { jsonLdHtml } from "@/lib/html";
import { APP_URL } from "@/lib/site";
import SmartNav from "@/components/SmartNav";
import SignupBanner from "@/components/SignupBanner";
import PageShell from "@/components/ui/PageShell";
import CommunityClient, { type ThreadPage } from "./CommunityClient";

// La Comunidad se lee sin cuenta y la encuentran los buscadores: el listado
// sale pintado del servidor (hilos, etiquetas y enlace a la página siguiente).
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "El foro de BG Planner: busca gente para jugar a juegos de mesa, comparte crónicas de tus partidas, opina y resuelve dudas de reglas.";

type SearchParams = Promise<{ tag?: string; cursor?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { tag, cursor } = await searchParams;
  const t = isCommunityTag(tag) ? getCommunityTag(tag) : null;
  const url = t ? `${APP_URL}/community?tag=${t.id}` : `${APP_URL}/community`;
  const title = t ? `${t.label} · Comunidad BG Planner` : "Comunidad · BG Planner";
  const description = t ? `${t.emoji} ${t.label}: ${t.hint.toLowerCase()}. ${DESCRIPTION}` : DESCRIPTION;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Las páginas siguientes no se indexan, pero sus hilos sí se recorren.
    ...(cursor ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url, type: "website", siteName: "BG Planner", locale: "es_ES" },
    twitter: { card: "summary", title, description },
  };
}

function listJsonLd(page: ThreadPage) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Conversaciones de la Comunidad de BG Planner",
    itemListElement: page.threads.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${APP_URL}/community/${t.id}`,
      name: t.title,
    })),
  };
}

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const { tag: tagParam, cursor } = await searchParams;
  const tag = isCommunityTag(tagParam) ? tagParam : null;
  const session = await getSession();
  const list = await listThreads({ tag, cursor, viewerId: session?.userId }).catch(() => ({
    threads: [],
    nextCursor: null,
    tagCounts: {},
  }));
  // Fechas a texto, igual que llegarían por la API.
  const initial = JSON.parse(JSON.stringify(list)) as ThreadPage;

  return (
    <PageShell nav={<SmartNav />} width="main">
      {initial.threads.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(listJsonLd(initial)) }} />
      )}
      <CommunityClient
        banner={!session && <SignupBanner variant="community" redirect="/community" />}
        initial={initial}
        initialLoggedIn={!!session}
        initialKey={cursor ? "__cursor__" : tag ?? ""}
      />
    </PageShell>
  );
}
