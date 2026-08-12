import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por foto (ya se redimensiona en cliente)

// Sube una foto al bucket de Storage y devuelve su URL pública. La foto se
// vincula a una opinión al crear/editar la GameReview con `photoUrls`.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  if (!getStorageClient()) {
    return NextResponse.json(
      { error: "La subida de fotos no está configurada" },
      { status: 503 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande (máx. 5 MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadPhoto(buffer, file.type, `groups/${groupId}`);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al subir la imagen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
