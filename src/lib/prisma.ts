import { PrismaClient } from "@prisma/client";
import { storedImageSrc } from "@/lib/storedImages";

const globalForPrisma = globalThis as unknown as { prismaBase: PrismaClient };

const base =
  globalForPrisma.prismaBase ||
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

/**
 * El cliente de siempre, con una salvedad: los avatares (`User.avatarUrl`) y
 * los carteles de evento (`Event.imageUrl`) guardados en base64 salen como
 * URL de /api/img (con una huella del contenido para la caché), no como el
 * data URL entero. Así no viajan cien kilobytes por imagen dentro de cada
 * respuesta y cada HTML; el navegador los baja una vez y los guarda. Vale
 * también en relaciones anidadas (`user: { select: { avatarUrl: true } }`).
 * Para leer el base64 de verdad está `prismaRaw`.
 */
export const prisma = base.$extends({
  result: {
    user: {
      avatarUrl: {
        needs: { id: true, avatarUrl: true },
        compute: (u) => storedImageSrc("avatar", u.id, u.avatarUrl),
      },
    },
    event: {
      imageUrl: {
        needs: { id: true, imageUrl: true },
        compute: (e) => storedImageSrc("event", e.id, e.imageUrl),
      },
    },
  },
});

/**
 * Sin la conversión de imágenes: el base64 tal cual. Solo para quien sirve o
 * incrusta la imagen (la ruta /api/img y las tarjetas para compartir).
 */
export const prismaRaw = base;
