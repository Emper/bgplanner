import { z } from "zod";
import { GROUP_TYPE_IDS } from "./groupTypes";
import { NOTIFICATION_TYPE_IDS } from "./notifications";

export const emailSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "El código debe tener 6 dígitos"),
});

export const profileSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  surname: z.string().min(1, "Los apellidos son obligatorios"),
  displayName: z.string().max(50).optional(),
  location: z.string().optional(),
  bggUsername: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().min(1, "El nombre del grupo es obligatorio").max(100),
  type: z.enum(GROUP_TYPE_IDS as [string, ...string[]]).default("friends"),
});

export const inviteSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const pingSchema = z.object({
  message: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
});

export const addGameSchema = z.object({
  bggId: z.number().int().positive(),
});

export const voteSchema = z.object({
  value: z.number().int().min(-10).max(10),
});

export const gameCommentSchema = z.object({
  text: z.string().trim().max(500, "Máximo 500 caracteres"),
});

// Opinión post-partida. Al menos uno de nota / texto / fotos debe venir.
export const gameReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).nullable().optional(),
    text: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
    sessionId: z.string().min(1).nullable().optional(),
    photoUrls: z
      .array(z.string().url("URL de foto no válida"))
      .max(8, "Máximo 8 fotos por opinión")
      .optional(),
  })
  .refine(
    (d) =>
      (d.rating != null) ||
      (!!d.text && d.text.length > 0) ||
      (!!d.photoUrls && d.photoUrls.length > 0),
    { message: "Añade una nota, un comentario o al menos una foto" }
  );

// Valoración de un evento. rating/text ambos opcionales; si llegan vacíos se
// interpreta como borrar la valoración propia.
export const eventReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  text: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

export const createEventSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1, "La fecha es obligatoria"),
  endDate: z.string().optional(),
  location: z.string().max(300).optional(),
  maxAttendees: z.number().int().positive().optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  imageUrl: z.string().nullable().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  imageUrl: z.string().nullable().optional(),
});

export const eventInterestSchema = z.object({
  eventGameId: z.string().min(1),
  intensity: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
});

export const feedbackSchema = z.object({
  subject: z.string().min(1, "El asunto es obligatorio").max(200),
  message: z.string().min(1, "El mensaje es obligatorio").max(5000),
  images: z.array(z.string()).max(5).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  email: z.string().email("Email no válido"),
  subject: z.string().min(1, "El asunto es obligatorio").max(200),
  message: z.string().min(1, "El mensaje es obligatorio").max(5000),
  honeypot: z.string().max(0).optional(),
});

// Borrado de cuenta: el usuario tiene que escribir su email exacto como
// confirmación. La comparación real (case-insensitive contra el email de la
// sesión) se hace en el handler.
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().min(1, "Escribe tu email para confirmar"),
});

// ── Moderación ──────────────────────────────────────────────────────────

// Denuncia de contenido. El objeto denunciado se identifica por tipo + id
// porque puede venir de tablas muy distintas (ver src/lib/moderation.ts).
export const reportSchema = z.object({
  targetType: z.enum(["photo", "review", "comment", "user"], {
    message: "Tipo de contenido no válido",
  }),
  targetId: z.string().min(1, "Falta el contenido a denunciar"),
  reason: z.enum(["offensive", "sexual", "harassment", "spam", "other"], {
    message: "Elige un motivo",
  }),
  detail: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

// Bloquear a una persona.
export const blockSchema = z.object({
  userId: z.string().min(1, "Falta la persona a bloquear"),
});

// Resolución de una denuncia desde el panel de superadmin.
export const reportReviewSchema = z.object({
  id: z.string().min(1, "Falta la denuncia"),
  status: z.enum(["pending", "actioned", "dismissed"], {
    message: "Estado no válido",
  }),
  reviewNote: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

// ── Notificaciones ──────────────────────────────────────────────────────
// Los tipos de aviso salen del catálogo de src/lib/notifications.ts: añadir uno
// allí lo habilita aquí automáticamente.

export const notificationPreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_IDS, { error: "Tipo de aviso no válido" }),
  email: z.boolean({ error: "Valor no válido para el email" }),
  push: z.boolean({ error: "Valor no válido para el móvil" }),
});

// Alta o refresco del token de push de un dispositivo.
export const deviceTokenSchema = z.object({
  token: z
    .string()
    .min(1, "Falta el token del dispositivo")
    .max(4096, "Token demasiado largo"),
  platform: z.enum(["ios", "android", "web"], {
    error: "Plataforma no válida",
  }),
});

// Baja del token (al cerrar sesión o al apagar las push).
export const deviceTokenDeleteSchema = z.object({
  token: z
    .string()
    .min(1, "Falta el token del dispositivo")
    .max(4096, "Token demasiado largo"),
});
