import {
  getEventByInviteCode,
  eventBadge,
  eventTagline,
} from "@/lib/publicLinks";
import {
  inlineImage,
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

export const alt = "Invitación a un evento de BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const event = await getEventByInviteCode(code);

  if (!event) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: "Esta invitación ya no vale.",
    });
  }

  return shareCardResponse({
    eyebrow: "Te invitan al evento",
    title: event.name,
    badge: eventBadge(event),
    tagline: eventTagline(event),
    image: await inlineImage(event.imageUrl),
  });
}
