import {
  getProfileHeader,
  profileCardStats,
  profileTagline,
} from "@/lib/publicProfile";
import {
  inlineImage,
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

export const alt = "Perfil en BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const header = await getProfileHeader(slug);
  const stats = header ? profileCardStats(header) : [];

  return shareCardResponse({
    title: header?.displayName ?? "BG Planner",
    badge: header?.bggUsername ? `@${header.bggUsername} en BGG` : null,
    badgeTone: "bgg",
    // Con cifras, la frase no cabe: el sitio pasa a su propia línea para no
    // perderlo, y los números cuentan lo demás.
    subtitle: stats.length && header?.location ? `de ${header.location}` : null,
    stats,
    tagline: header
      ? profileTagline(header)
      : "Organiza las partidas de tu grupo de juegos de mesa.",
    image: await inlineImage(header?.avatarUrl),
    round: true,
  });
}
