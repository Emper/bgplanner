import { getPublicGroup, groupTagline } from "@/lib/publicLinks";
import {
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

export const alt = "Grupo en BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getPublicGroup(id);

  if (!group) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: "Organiza las partidas de tu grupo de juegos de mesa.",
    });
  }

  return shareCardResponse({
    eyebrow: "Grupo de BG Planner",
    title: group.name,
    tagline: groupTagline(group),
  });
}
