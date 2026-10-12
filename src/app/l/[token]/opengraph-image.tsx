import { findSharedList } from "@/lib/sharedList";
import {
  inlineImage,
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

// La tarjeta de una lista compartida: quién la comparte y, en la balda, las
// portadas de lo que más ganas tiene de jugar.
export const alt = "Lista de juegos para un evento en BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

const COVERS = 5;

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const list = await findSharedList(token);

  // Enlace revocado: tarjeta genérica, sin contar nada.
  if (!list) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: "Organiza las partidas de tu grupo de juegos de mesa.",
    });
  }

  const urls = list.pending
    .map((i) => i.game.thumbnail)
    .filter((url): url is string => !!url)
    .slice(0, COVERS);
  const inlined = await Promise.all(urls.map((url) => inlineImage(url)));
  const covers = inlined.filter((src): src is string => src !== null);
  const total = list.pending.length + list.played.length;

  return shareCardResponse({
    eyebrow: "La lista de juegos de",
    title: list.ownerName,
    // De un evento privado no sale el nombre fuera de la app.
    badge: list.event.isPublic ? list.event.name : null,
    tagline: `${total} ${total === 1 ? "juego" : "juegos"} que quiere jugar, de más a menos ganas.`,
    shelf: covers,
  });
}
