import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { isSuperadminRole } from "@/lib/auth";
import { avatarSchema, profileSchema } from "@/lib/validations";
import { validateBggUsername } from "@/lib/bgg";
import { slugifyUsername } from "@/lib/users";

// El perfil público vive en /users/<slug>, y el slug sale del usuario de BGG
// la primera vez que se conecta. Nunca falla hacia fuera: si ese slug ya es de
// otra persona (o se lo lleva otro a la vez), esta se queda sin él y su perfil
// sigue accesible por id. Así ni el registro ni vincular BGG se rompen por un
// nombre repetido. Tampoco se libera al desvincular BGG: para entonces ya es
// una dirección que ha podido compartir.
async function claimSlugFromBgg(
  userId: string,
  current: { slug: string | null; bggUsername: string | null }
): Promise<string | null> {
  if (current.slug) return current.slug;

  const candidate = slugifyUsername(current.bggUsername);
  if (!candidate) return null;

  const taken = await prisma.user.findUnique({
    where: { slug: candidate },
    select: { id: true },
  });
  if (taken) return null;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { slug: candidate },
    });
    return candidate;
  } catch {
    // Carrera con otro que reclamó el mismo slug entre la consulta y el
    // update: se queda sin él y a seguir.
    return null;
  }
}

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  // ?lite=1 es lo que pide la cabecera en cada página: sin el avatar (va
  // incrustado y pesa) ni datos que no pinta.
  const lite = request.nextUrl.searchParams.get("lite") === "1";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: !lite,
      name: true,
      surname: !lite,
      location: !lite,
      bggUsername: true,
      avatarUrl: !lite,
      displayName: true,
      slug: true,
      role: true,
    },
  });

  // Un token válido de una cuenta que ya no existe no cuenta como sesión
  if (!user) throw new ApiError(401, "No autorizado");

  // El rol ya viene en la fila: sin volver a leerla para saber si es admin
  return NextResponse.json({ ...user, isSuperadmin: isSuperadminRole(user.role, session.email) });
});

export const PUT = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const parsed = await parseBody(request, profileSchema);

  // Sin nombre visible, el nombre. El usuario de BGG, normalizado ("" lo
  // desvincula) y comprobado contra BGG si viene relleno.
  const bggUsername = parsed.bggUsername?.trim().toLowerCase();
  if (bggUsername) {
    const validation = await validateBggUsername(bggUsername);
    if (!validation.valid) {
      throw new ApiError(400, validation.error ?? "No encontramos ese usuario en BGG");
    }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...parsed,
      displayName: parsed.displayName?.trim() ? parsed.displayName : parsed.name,
      bggUsername,
    },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      location: true,
      bggUsername: true,
      avatarUrl: true,
      displayName: true,
      slug: true,
    },
  });

  const slug = await claimSlugFromBgg(session.userId, user);
  return NextResponse.json({ ...user, slug });
});

// PATCH: solo el avatar (una imagen ya redimensionada, o null para quitarlo)
export const PATCH = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { avatarUrl } = await parseBody(request, avatarSchema);

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl },
    select: { avatarUrl: true },
  });

  return NextResponse.json(user);
});
