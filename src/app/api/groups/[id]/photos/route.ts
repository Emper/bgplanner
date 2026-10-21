import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler, requireGroupMember, requireSession } from "@/lib/api";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por foto (ya se redimensiona en cliente)

// Sube una foto al bucket de Storage y devuelve su URL pública. La foto se
// vincula a una opinión al crear/editar la GameReview con `photoUrls`.
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;

    await requireGroupMember(groupId, session.userId);

    if (!getStorageClient()) {
      throw new ApiError(503, "La subida de fotos no está configurada");
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "No se recibió ninguna imagen");
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(400, "La imagen es demasiado grande (máx. 5 MB)");
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadPhoto(buffer, file.type, `groups/${groupId}`);
      return NextResponse.json({ url });
    } catch (err) {
      // El detalle va a los logs; al usuario, solo lo que puede arreglar él.
      console.error("[photos] fallo al subir foto de opinión:", err);
      if (err instanceof Error && err.message === "Formato de imagen no soportado") {
        throw new ApiError(400, "Formato de imagen no soportado (usa JPG, PNG o WebP)");
      }
      throw new ApiError(502, "No se pudo subir la imagen");
    }
  }
);
