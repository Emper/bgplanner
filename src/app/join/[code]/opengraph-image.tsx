import { getGroupByInviteCode, groupTagline } from "@/lib/publicLinks";
import {
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

export const alt = "Invitación a un grupo de BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);

  if (!group) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: "Esta invitación ya no vale.",
    });
  }

  return shareCardResponse({
    eyebrow: "Te invitan al grupo",
    title: group.name,
    tagline: groupTagline(group),
  });
}
