import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getCommunityTag, isCommunityTag } from "@/lib/community";
import { listThreads } from "@/lib/communityServer";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import SignupBanner from "@/components/SignupBanner";
import CommunityClient, { type ThreadPage } from "./CommunityClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

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
  const [session, list] = await Promise.all([
    getSession(),
    listThreads({ tag, cursor }).catch(() => ({ threads: [], nextCursor: null, tagCounts: {} })),
  ]);
  // Fechas a texto, igual que llegarían por la API.
  const initial = JSON.parse(JSON.stringify(list)) as ThreadPage;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {initial.threads.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd(initial)).replace(/</g, "\\u003c") }}
        />
      )}
      <SmartNav />
      <CommunityClient
        banner={!session && <SignupBanner variant="community" redirect="/community" />}
        initial={initial}
        initialLoggedIn={!!session}
        initialKey={cursor ? "__cursor__" : tag ?? ""}
      />
      <Footer />
    </div>
  );
}
