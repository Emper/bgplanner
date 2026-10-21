import { z } from "zod";
import { GROUP_TYPE_IDS } from "./groupTypes";
import { sanitizeUserText, EVENT_ABOUT_MAX } from "./text";
import { FEATURE_STATUS_IDS } from "./features";
import { checkManualUrl } from "./bggLinks";
import {
  COMMUNITY_TAG_IDS,
  REPLY_BODY_MAX,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
} from "./community";
import { REPORT_REASON_IDS, REPORT_TARGET_TYPES, REPORT_TEXT_MAX } from "./reports";

// Los textos libres del usuario pueden llevar emojis sin problema. Lo único
// que se limpia (siempre al final de la cadena, tras validar longitudes) son
// bytes nulos y mitades sueltas de emoji, que Postgres rechaza y que aparecen
// cuando el cliente corta un texto por medio de un carácter.
const clean = sanitizeUserText;

// Los emails se guardan y se buscan siempre sin espacios y en minúsculas:
// si no, «Ana@x.com» y «ana@x.com» acababan siendo dos cuentas distintas y
// el límite de códigos se saltaba cambiando una mayúscula.
const normalizedEmail = () =>
  z.string().trim().toLowerCase().email("Email no válido").max(255, "Email demasiado largo");

export const emailSchema = z.object({
  email: normalizedEmail(),
});

export const otpSchema = z.object({
  email: normalizedEmail(),
  code: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
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
  email: normalizedEmail(),
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
  // Por si BGG no responde: el nombre que ya se veía en la búsqueda.
  name: z.string().trim().max(300).transform(clean).optional(),
});

// Enlace al manual de un juego: BGG, Drive, Dropbox… pero nada que caduque
export const gameManualSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Pega el enlace al manual")
    .max(500, "Ese enlace es demasiado largo")
    .superRefine((v, ctx) => {
      const check = checkManualUrl(v);
      if (!check.ok) ctx.addIssue({ code: "custom", message: check.error });
    }),
});

// Enlace a una geeklist de BGG (o su número) para tomar de ella los juegos
export const geeklistLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Pega el enlace de la lista de BGG")
    .max(500, "Ese enlace es demasiado largo")
    .refine((v) => /boardgamegeek\.com\/geeklist\/\d+/i.test(v) || /^\d+$/.test(v), {
      message: "Eso no parece un enlace a una lista de BGG (boardgamegeek.com/geeklist/…)",
    }),
});

export const voteSchema = z.object({
  value: z
    .number("Voto no válido")
    .int("Voto no válido")
    .min(-10, "Voto no válido")
    .max(10, "Voto no válido"),
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

// "¡Lo jugamos!" desde la noche de juego. Sin nightId abre una noche nueva.
export const gameNightPlaySchema = z.object({
  nightId: z.string().min(1).nullable().optional(),
  gameId: z.string().min(1, "Falta el juego"),
  playerIds: z
    .array(z.string().min(1))
    .min(1, "Marca al menos a una persona")
    .max(100, "Demasiados jugadores"),
});

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

// El cartel de un evento: una imagen nueva (base64 redimensionada en el
// navegador o una URL https), quitarlo (null) o el que ya tenía, que la API
// sirve como /api/img/….
const eventImage = z
  .string()
  .max(3_000_000, "Imagen demasiado grande")
  .refine(
    (v) => v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("/api/img/"),
    "Imagen no válida"
  )
  .nullable()
  .optional();

export const createEventSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200).transform(clean),
  description: z.string().max(2000).transform(clean).optional(),
  about: z.string().max(EVENT_ABOUT_MAX, `La info general admite ${EVENT_ABOUT_MAX} caracteres como máximo`).transform(clean).optional(),
  date: z.string().min(1, "La fecha es obligatoria"),
  endDate: z.string().optional(),
  location: z.string().max(300).transform(clean).optional(),
  maxAttendees: z.number().int().positive().optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  imageUrl: eventImage,
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
  imageUrl: eventImage,
});

export const eventAttendSchema = z.object({
  status: z.enum(["attending", "maybe"], { error: "Estado no válido" }).default("attending"),
});

export const eventAttendeeRoleSchema = z.object({
  role: z.enum(["attendee", "admin"], { error: "Rol inválido" }),
});

export const eventInterestSchema = z.object({
  eventGameId: z.string().min(1),
  intensity: z.number().int().min(0).max(5), // 0 = no quiero jugarlo
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
  // Respuesta del mismo hilo a la que se contesta citándola.
  quotedReplyId: z.string().min(1).max(40).optional(),
});

// Editar una respuesta solo cambia su texto, no lo que cita.
export const replyEditSchema = replySchema.pick({ body: true });

export const contactSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100).transform(clean),
  email: normalizedEmail(),
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
  // Campo trampa: si viene relleno es un bot. Se acepta aquí y el handler
  // contesta "enviado" sin enviar nada, para que el bot no aprenda.
  honeypot: z.string().max(500).optional(),
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

// Denunciar algo (ver src/lib/reports.ts para los tipos y motivos).
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES, { error: "No se puede denunciar esto" }),
  targetId: z.string().trim().min(1, "Falta qué denunciar").max(64, "Contenido no válido"),
  reason: z.enum(REPORT_REASON_IDS, { error: "Elige un motivo" }),
  text: z
    .string()
    .trim()
    .max(REPORT_TEXT_MAX, `Máximo ${REPORT_TEXT_MAX} caracteres`)
    .transform(clean)
    .optional()
    .nullable(),
});

// Qué hace el superadmin con una denuncia: retirar lo denunciado, cerrarla
// sin retirar nada (las de usuarios) o descartarla.
// Expulsar (expel) además borra la cuenta de su autor y veta su email;
// removeContent retira también sus mensajes de la Comunidad y sus fotos.
export const reportActionSchema = z.object({
  action: z.enum(["remove", "resolve", "dismiss", "expel"], { error: "Acción no válida" }),
  removeContent: z.boolean().optional(),
});

// Readmitir a alguien expulsado: se quita su email de la lista.
export const readmitSchema = z.object({
  email: normalizedEmail(),
});

export const blockSchema = z.object({
  userId: z.string().trim().min(1, "Falta a quién bloquear").max(64, "Usuario no válido"),
});

// ── Cuerpos pequeños que antes se comprobaban a mano ───────────────────

/** Marcar un juego del grupo como jugado o archivado (o deshacerlo). */
export const groupGamePatchSchema = z
  .object({ played: z.boolean().optional(), archived: z.boolean().optional() })
  .refine((d) => d.played !== undefined || d.archived !== undefined, "Indica si está jugado o archivado");

/** Activar o desactivar el enlace de invitación. */
export const inviteLinkToggleSchema = z.object({
  enabled: z.boolean("Indica si el enlace está activo"),
});

/** Cambiar el rol de un miembro del grupo. */
export const memberRoleSchema = z.object({
  role: z.enum(["admin", "member"], "Rol no válido"),
});

/** Fijar un grupo arriba en tu lista. */
export const groupPinSchema = z.object({
  pinned: z.boolean("Indica si va fijado"),
});

/** Quitar tu interés por un juego de un evento. */
export const eventInterestDeleteSchema = z.object({
  eventGameId: z.string().trim().min(1, "Falta el juego").max(64, "Juego no válido"),
});

/** La foto de perfil: una imagen ya redimensionada en el navegador, o quitarla. */
export const avatarSchema = z.object({
  avatarUrl: z
    .string()
    .max(200000, "Imagen demasiado grande")
    .refine((v) => v.startsWith("data:image/") || v.startsWith("https://"), "Imagen no válida")
    .nullable(),
});
