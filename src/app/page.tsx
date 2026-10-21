import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingPublicEvents } from "@/lib/publicLinks";
import { safeRedirect } from "@/lib/safeRedirect";
import Landing, { type DemoDate, type LandingEvent, type LandingThread } from "@/components/landing/Landing";
import { CHANGELOG } from "@/lib/changelog";
import { getLatestThreads, type ThreadListItem } from "@/lib/communityServer";
import { APP_TZ, formatRelativeTime } from "@/lib/format";
import { jsonLdHtml } from "@/lib/html";
import { APP_URL, loginHref } from "@/lib/site";
import HomeDashboard, { type HomeInitial } from "@/components/HomeDashboard";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import PageShell from "@/components/ui/PageShell";
import { getHomeData } from "@/lib/homeData";

// Con sesión, tu inicio (grupos, eventos, amigos y actividad); sin ella, la
// portada con los próximos eventos abiertos. Se decide en el servidor para no enseñar un loader a
// quien viene de fuera (y para que los buscadores vean el contenido).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BG Planner · Decide con tus amigos a qué jugar",
  // Una sola dirección para la portada aunque llegue con ?redirect=…
  alternates: { canonical: APP_URL },
  description:
    "Juntad vuestras colecciones de BoardGameGeek, votad vuestros juegos de mesa favoritos y dejad que el ranking decida la próxima partida. Ordena tu ludoteca y encuentra eventos donde apuntar qué quieres jugar.",
  openGraph: {
    title: "BG Planner · Decide con tus amigos a qué jugar",
    description:
      "Grupos, votaciones, ranking, tu colección en estantería y eventos de juegos de mesa. Gratis y sin contraseñas.",
    type: "website",
    siteName: "BG Planner",
    locale: "es_ES",
  },
  // La imagen la pone opengraph-image.tsx; aquí solo pedimos la grande en X.
  twitter: {
    card: "summary_large_image",
    title: "BG Planner · Decide con tus amigos a qué jugar",
    description:
      "Grupos, votaciones, ranking, tu colección en estantería y eventos de juegos de mesa. Gratis y sin contraseñas.",
  },
};

// Quién somos para los buscadores: el sitio (con su nombre, para que Google
// no lo enseñe como "bgplanner.app") y la aplicación, gratuita.
const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "BG Planner",
      inLanguage: "es-ES",
    },
    {
      "@type": "WebApplication",
      name: "BG Planner",
      url: APP_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      inLanguage: "es-ES",
      description:
        "Juntad vuestras colecciones de BoardGameGeek, votad vuestros juegos de mesa favoritos y dejad que el ranking decida la próxima partida.",
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
    },
  ],
};

// Las fechas se formatean aquí, en hora de España, para que servidor y
// navegador pinten lo mismo.
function toLandingEvent(e: Awaited<ReturnType<typeof getUpcomingPublicEvents>>[number]): LandingEvent {
  const d = new Date(e.date);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleString("es-ES", { timeZone: APP_TZ, ...opts }).replace(".", "");
  return {
    id: e.id,
    name: e.name,
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    time: part({ hour: "2-digit", minute: "2-digit" }),
    location: e.location,
    attendeeCount: e.attendeeCount,
    gameCount: e.gameCount,
    imageUrl: e.imageUrl,
  };
}

function toLandingThread(t: ThreadListItem): LandingThread {
  return {
    id: t.id,
    title: t.title,
    tag: t.tag,
    authorName: t.author.name,
    authorAvatar: t.author.avatarUrl,
    replyCount: t.replyCount,
    when: formatRelativeTime(t.lastActivityAt),
  };
}

// La maqueta de eventos de la portada se fecha el próximo sábado (o hoy, si
// es sábado), para que nunca enseñe un evento ya pasado.
function nextSaturday(): DemoDate {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
  return {
    day: String(d.getUTCDate()),
    month: d.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
  };
}

// Los datos del inicio, pedidos aquí y no desde el navegador. Va dentro de un
// Suspense: la cabecera y el dado salen al momento y esto llega después en
// la misma respuesta.
async function HomeData({ userId }: { userId: string }) {
  let initial: HomeInitial;
  try {
    // Mismo JSON que daba la API: fechas como texto, etc.
    initial = JSON.parse(JSON.stringify(await getHomeData(userId))) as HomeInitial;
  } catch {
    // Lo mismo que pintaba el navegador si fallaba /api/groups
    return <HomeDashboard initialError="Error al cargar tu inicio" />;
  }
  return <HomeDashboard initial={initial} />;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  const target = safeRedirect(redirectParam);

  const session = await getSession();
  if (session) {
    // Un token válido de una cuenta que ya no existe no cuenta como sesión.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });
    if (user) {
      if (target) redirect(target);
      return (
        <Suspense
          fallback={
            <PageShell nav={<Navbar />} width="wide">
              <PageLoader withNavbar />
            </PageShell>
          }
        >
          <HomeData userId={session.userId} />
        </Suspense>
      );
    }
  }

  const [events, threads] = await Promise.all([
    getUpcomingPublicEvents(3).catch(() => []),
    getLatestThreads(4).catch(() => []),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(SITE_JSON_LD) }} />
      <Landing
        events={events.map(toLandingEvent)}
        threads={threads.map(toLandingThread)}
        loginHref={loginHref(target)}
        latest={
          // La última entrada con algo nuevo: una de solo arreglos no luce en
          // el aviso «Nuevo».
          CHANGELOG.find((e) => e.changes.some((c) => c.type === "new"))?.title ?? "Mira las últimas novedades"
        }
        demoDate={nextSaturday()}
      />
    </>
  );
}
