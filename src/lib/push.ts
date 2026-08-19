/**
 * Envío de notificaciones push por FCM HTTP v1.
 *
 * Una sola pasarela para los dos sistemas: Android recibe directamente de FCM e
 * iOS a través de APNs, que Firebase gestiona por dentro. Aquí solo hablamos con
 * la API HTTP v1 de FCM.
 *
 * Credenciales: cuenta de servicio de Firebase en variables de entorno
 * (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`). Mientras no estén
 * configuradas, todo esto degrada a un no-op silencioso: la web tiene que seguir
 * funcionando igual, solo que sin push.
 *
 * El JWT de la cuenta de servicio se firma con `jose` (ya en el proyecto), sin
 * meter el SDK de Firebase, que es enorme y no aporta nada para esto.
 */

import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "./prisma";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export interface PushMessage {
  title: string;
  body: string;
  /** Datos extra que viajan con la push. Solo strings: FCM no admite otra cosa. */
  data?: Record<string, string>;
}

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Lee la cuenta de servicio del entorno. Devuelve null si falta algo. */
function getServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const rawKey = process.env.FCM_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) return null;

  // En Vercel la clave se pega en una sola línea con "\n" literales: hay que
  // devolverle los saltos de línea reales o `importPKCS8` no la reconoce.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return { projectId, clientEmail, privateKey };
}

/** ¿Están configuradas las credenciales de Firebase? */
export function isPushConfigured(): boolean {
  return getServiceAccount() !== null;
}

// Aviso una sola vez por proceso: si no, cada envío ensucia los logs.
let warnedMissingConfig = false;

function warnMissingConfig() {
  if (warnedMissingConfig) return;
  warnedMissingConfig = true;
  console.warn(
    "[push] Firebase sin configurar (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY). Las notificaciones push se omiten."
  );
}

/* ── Token de acceso OAuth2 ───────────────────────────────────────────── */

// Google da tokens de 1 hora. Los cacheamos en memoria del proceso para no
// pedir uno nuevo en cada envío (una convocatoria manda N pushes seguidas).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(account: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  // Margen de 60 s para no usar un token que caduque en pleno vuelo.
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }

  try {
    const key = await importPKCS8(account.privateKey, "RS256");
    const assertion = await new SignJWT({ scope: FCM_SCOPE })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(account.clientEmail)
      .setSubject(account.clientEmail)
      .setAudience(TOKEN_ENDPOINT)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!res.ok) {
      console.warn("[push] No se pudo obtener el token de FCM:", res.status);
      return null;
    }

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;

    cachedToken = {
      value: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.warn("[push] Error firmando el JWT de servicio:", err);
    return null;
  }
}

/* ── Envío ────────────────────────────────────────────────────────────── */

// Códigos de FCM que significan "este token ya no vale": el dispositivo
// desinstaló la app, cambió el token o nunca fue válido. Se limpian de la BD.
const DEAD_TOKEN_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT"]);

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const details = (error as { details?: unknown }).details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const code = (detail as { errorCode?: unknown })?.errorCode;
      if (typeof code === "string") return code;
    }
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

/**
 * Manda una push a una lista de tokens de dispositivo.
 *
 * Nunca lanza: un fallo de push jamás debe tumbar la petición que la origina.
 * Los tokens que FCM rechaza como muertos se borran de la BD sobre la marcha.
 */
export async function sendPush(
  tokens: string[],
  message: PushMessage
): Promise<void> {
  if (tokens.length === 0) return;

  const account = getServiceAccount();
  if (!account) {
    warnMissingConfig();
    return;
  }

  const accessToken = await getAccessToken(account);
  if (!accessToken) return;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`;
  const deadTokens: string[] = [];

  // FCM v1 no tiene envío múltiple en la API REST pública: un POST por token.
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data ?? {},
              android: {
                priority: "HIGH",
                notification: { sound: "default" },
              },
              apns: {
                payload: { aps: { sound: "default", badge: 1 } },
              },
            },
          }),
        });

        if (res.ok) return;

        const payload = await res.json().catch(() => null);
        const code = extractErrorCode(payload);
        if (code && DEAD_TOKEN_CODES.has(code)) {
          deadTokens.push(token);
        } else {
          console.warn("[push] FCM devolvió", res.status, code ?? "");
        }
      } catch (err) {
        console.warn("[push] Error enviando la push:", err);
      }
    })
  );

  if (deadTokens.length > 0) {
    await prisma.deviceToken
      .deleteMany({ where: { token: { in: deadTokens } } })
      .catch(() => {});
  }
}
