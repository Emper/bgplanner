import { z } from "zod";
import { GROUP_TYPE_IDS } from "./groupTypes";
import { sanitizeUserText, EVENT_ABOUT_MAX } from "./text";
import { FEATURE_STATUS_IDS } from "./features";
import {
  COMMUNITY_TAG_IDS,
  REPLY_BODY_MAX,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
} from "./community";

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
  about: z.string().max(EVENT_ABOUT_MAX, `La info general admite ${EVENT_ABOUT_MAX} caracteres como máximo`).transform(clean).optional(),
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
  about: z.string().max(EVENT_ABOUT_MAX, `La info general admite ${EVENT_ABOUT_MAX} caracteres como máximo`).transform(clean).nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().max(300).transform(clean).nullable().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  imageUrl: z.string().nullable().optional(),
});

export const eventAttendSchema = z.object({
  status: z.enum(["attending", "maybe"], { error: "Estado no válido" }).default("attending"),
});

export const eventAttendeeRoleSchema = z.object({
  role: z.enum(["attendee", "admin"], { error: "Rol inválido" }),
});

export const eventInterestSchema = z.object({
  eventGameId: z.string().min(1),
  intensity: z.number().int().min(1).max(5),
  notes: z.string().max(500).transform(clean).optional(),
  played: z.boolean().optional(),
});

// Lo que el usuario anota sobre un juego de su colección. Los tres campos
// son opcionales por separado: la UI manda solo el que cambia. `keepScore`
// a null borra la puntuación (el juego vuelve a "sin valorar").
export const collectionEntrySchema = z
  .object({
    keepScore: z.number().int().min(1).max(5).nullable().optional(),
    note: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres")
      .transform(clean)
      .nullable()
      .optional(),
    showcased: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que actualizar",
  });

// Guardar en la wishlist o descartar un juego recomendado; null lo deja como
// estaba antes de tocarlo.
export const gameFlagSchema = z.object({
  flag: z.enum(["wishlist", "dismissed"], { error: "Acción no válida" }).nullable(),
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

export const featureCreateSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(200).transform(clean),
  description: z.string().min(1, "La descripción es obligatoria").max(2000).transform(clean),
  status: z.enum(FEATURE_STATUS_IDS).optional(),
});

export const featureUpdateSchema = z
  .object({
    title: z.string().min(1, "El título es obligatorio").max(200).transform(clean).optional(),
    description: z.string().min(1, "La descripción es obligatoria").max(2000).transform(clean).optional(),
    status: z.enum(FEATURE_STATUS_IDS).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No hay nada que actualizar" });

// Hilos y respuestas de /community. El trim va antes de validar para que un
// mensaje de solo espacios cuente como vacío.
const threadTitle = z
  .string()
  .trim()
  .min(3, "El título es demasiado corto")
  .max(THREAD_TITLE_MAX, `El título no puede pasar de ${THREAD_TITLE_MAX} caracteres`)
  .transform(clean);
const threadBody = z
  .string()
  .trim()
  .min(1, "Escribe algo para abrir el hilo")
  .max(THREAD_BODY_MAX, "El mensaje es demasiado largo")
  .transform(clean);
const threadTag = z.enum(COMMUNITY_TAG_IDS, "Elige una etiqueta");

export const threadCreateSchema = z.object({
  title: threadTitle,
  body: threadBody,
  tag: threadTag,
});

export const threadUpdateSchema = z
  .object({
    title: threadTitle.optional(),
    body: threadBody.optional(),
    tag: threadTag.optional(),
    pinned: z.boolean().optional(), // solo superadmin
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No hay nada que actualizar" });

export const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "La respuesta está vacía")
    .max(REPLY_BODY_MAX, "La respuesta es demasiado larga")
    .transform(clean),
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

export const friendAddSchema = z.object({
  userId: z.string().trim().min(1, "Falta a quién añadir").max(64, "Usuario no válido"),
});

export const notificationsReadSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(100, "Demasiadas notificaciones").optional(),
});

// Solo endpoints de los servicios de push de los navegadores: el servidor
// hace POST a esta URL, así que no puede ser una cualquiera (SSRF).
const PUSH_HOST_SUFFIXES = [
  ".googleapis.com", // Chrome, Edge Android, Samsung, Opera (FCM)
  ".push.apple.com", // Safari e iOS
  ".mozilla.com", // Firefox
  ".notify.windows.com", // Edge en Windows
];

function isPushServiceUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(1000, "Suscripción no válida")
    .refine(isPushServiceUrl, "Este navegador usa un servicio de avisos que no admitimos"),
  keys: z.object({
    p256dh: z.string().min(1, "Suscripción no válida").max(200, "Suscripción no válida"),
    auth: z.string().min(1, "Suscripción no válida").max(100, "Suscripción no válida"),
  }),
  // Desde dónde se activó (para medir qué aviso convence más)
  source: z.enum(["settings", "bell", "launch", "community", "event", "group"]).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1, "Falta la suscripción").max(1000, "Suscripción no válida"),
});

// Borrar la cuenta: hay que escribir la palabra a mano (sin importar
// mayúsculas ni espacios) para que no se haga de un clic despistado.
export const accountDeleteSchema = z.object({
  confirm: z
    .string({ error: "Escribe BORRAR para confirmar" })
    .max(20, "Escribe BORRAR para confirmar")
    .refine((v) => v.trim().toUpperCase() === "BORRAR", "Escribe BORRAR para confirmar"),
  removePhotos: z.boolean().optional().default(false),
});
