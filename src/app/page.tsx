import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingPublicEvents } from "@/lib/publicLinks";
import { safeRedirect } from "@/lib/safeRedirect";
import Landing, { type LandingEvent } from "@/components/landing/Landing";

// Con sesión se salta la portada; sin ella, la portada con los próximos
// eventos abiertos. Se decide en el servidor para no enseñar un loader a
// quien viene de fuera (y para que los buscadores vean el contenido).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BG Planner · Decide con tus amigos a qué jugar",
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
};

// Las fechas se formatean aquí, en hora de España, para que servidor y
// navegador pinten lo mismo.
const TZ = "Europe/Madrid";

function toLandingEvent(e: Awaited<ReturnType<typeof getUpcomingPublicEvents>>[number]): LandingEvent {
  const d = new Date(e.date);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleString("es-ES", { timeZone: TZ, ...opts }).replace(".", "");
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
    if (user) redirect(target || "/groups");
  }

  const events = await getUpcomingPublicEvents(3).catch(() => []);
  const loginHref = target ? `/login?redirect=${encodeURIComponent(target)}` : "/login";

  return <Landing events={events.map(toLandingEvent)} loginHref={loginHref} />;
}
