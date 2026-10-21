import { prismaRaw } from "@/lib/prisma";
import type { StoredImageKind } from "@/lib/storedImages";

/**
 * El base64 original de un avatar o un cartel (ver storedImages.ts), sin
 * comprobar quién lo pide: eso lo decide quien llama.
 */
export async function readStoredImage(kind: StoredImageKind, id: string) {
  if (kind === "avatar") {
    const user = await prismaRaw.user.findUnique({ where: { id }, select: { avatarUrl: true } });
    return { value: user?.avatarUrl ?? null, visibility: "public" as const };
  }
  const event = await prismaRaw.event.findUnique({
    where: { id },
    select: { imageUrl: true, visibility: true },
  });
  return {
    value: event?.imageUrl ?? null,
    visibility: event?.visibility === "public" ? ("public" as const) : ("private" as const),
  };
}

/** `/api/img/avatar/abc?v=…` → { kind: "avatar", id: "abc" }, o null. */
export function parseStoredImagePath(path: string): { kind: StoredImageKind; id: string } | null {
  const match = /^\/api\/img\/(avatar|event)\/([^/?#]+)/.exec(path);
  return match ? { kind: match[1] as StoredImageKind, id: decodeURIComponent(match[2]) } : null;
}
