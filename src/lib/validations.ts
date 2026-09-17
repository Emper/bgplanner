import { z } from "zod";
import { GROUP_TYPE_IDS } from "./groupTypes";
import { sanitizeUserText } from "./text";

// Los textos libres del usuario pueden llevar emojis sin problema. Lo único
// que se limpia (siempre al final de la cadena, tras validar longitudes) son
// bytes nulos y mitades sueltas de emoji, que Postgres rechaza y que aparecen
// cuando el cliente corta un texto por medio de un carácter.
const clean = sanitizeUserText;

export const emailSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "El código debe tener 6 dígitos"),
});

// Cambio de email del usuario logueado: se pide el nuevo email y luego se
// confirma con el código de 6 dígitos que le llega a esa dirección.
export const emailChangeRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email no válido")
    .max(255, "Email demasiado largo"),
});

export const emailChangeConfirmSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export const profileSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").transform(clean),
  surname: z.string().min(1, "Los apellidos son obligatorios").transform(clean),
  displayName: z.string().max(50).transform(clean).optional(),
  location: z.string().transform(clean).optional(),
  bggUsername: z.string().optional(),
});

export const groupSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre del grupo es obligatorio")
    .max(100)
    .transform(clean),
  type: z.enum(GROUP_TYPE_IDS as [string, ...string[]]).default("friends"),
});

export const inviteSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const pingSchema = z.object({
  message: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .transform(clean)
    .optional(),
  // Variante destructiva de la convocatoria: además de avisar por email,
  // borra todos los votos del grupo (los juegos se quedan). Solo admins;
  // la UI pide reconfirmación antes de enviarlo.
  resetVotes: z.boolean().optional(),
});

export const addGameSchema = z.object({
  bggId: z.number().int().positive(),
});

export const voteSchema = z.object({
  value: z.number().int().min(-10).max(10),
});

export const gameCommentSchema = z.object({
  text: z.string().trim().max(500, "Máximo 500 caracteres").transform(clean),
});

// Opinión post-partida. Al menos uno de nota / texto / fotos debe venir.
export const gameReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).nullable().optional(),
    text: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres")
      .transform(clean)
      .optional(),
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
  text: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .transform(clean)
    .optional(),
});

export const createEventSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200).transform(clean),
  description: z.string().max(2000).transform(clean).optional(),
  date: z.string().min(1, "La fecha es obligatoria"),
  endDate: z.string().optional(),
  location: z.string().max(300).transform(clean).optional(),
  maxAttendees: z.number().int().positive().optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  imageUrl: z.string().nullable().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(200).transform(clean).optional(),
  description: z.string().max(2000).transform(clean).nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().max(300).transform(clean).nullable().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  imageUrl: z.string().nullable().optional(),
});

export const eventInterestSchema = z.object({
  eventGameId: z.string().min(1),
  intensity: z.number().int().min(1).max(5),
  notes: z.string().max(500).transform(clean).optional(),
});

export const feedbackSchema = z.object({
  subject: z
    .string()
    .min(1, "El asunto es obligatorio")
    .max(200)
    .transform(clean),
  message: z
    .string()
    .min(1, "El mensaje es obligatorio")
    .max(5000)
    .transform(clean),
  images: z.array(z.string()).max(5).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100).transform(clean),
  email: z.string().email("Email no válido"),
  subject: z
    .string()
    .min(1, "El asunto es obligatorio")
    .max(200)
    .transform(clean),
  message: z
    .string()
    .min(1, "El mensaje es obligatorio")
    .max(5000)
    .transform(clean),
  honeypot: z.string().max(0).optional(),
});
