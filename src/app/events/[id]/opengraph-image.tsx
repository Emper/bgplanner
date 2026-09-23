import { getPublicEvent, eventBadge, eventTagline } from "@/lib/publicLinks";
import {
  inlineImage,
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

export const alt = "Evento en BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPublicEvent(id);

  // De un evento privado no sale nada por aquí, ni aunque alguien pida esta
  // dirección a mano: la página ya no la enlaza, y si la piden, tarjeta muda.
  if (!event || !event.isPublic) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: event
        ? "Este evento es privado."
        : "Organiza las partidas de tu grupo de juegos de mesa.",
    });
  }

  return shareCardResponse({
    eyebrow: "Evento abierto",
    title: event.name,
    badge: eventBadge(event),
    tagline: eventTagline(event),
    image: await inlineImage(event.imageUrl),
  });
}
