import { NextResponse } from "next/server";

/**
 * Apple App Site Association (AASA) — habilita los Universal Links de iOS.
 *
 * Se sirve en https://bgplanner.app/.well-known/apple-app-site-association
 * (sin extensión .json y con Content-Type application/json, tal y como exige Apple).
 * Apple lo descarga a través de su CDN cuando se instala la app, así que los cambios
 * pueden tardar en propagarse: durante el desarrollo se usa el modo `developer` de
 * los Associated Domains en Xcode para saltarse la caché.
 *
 * Requiere la variable de entorno APPLE_TEAM_ID (Team ID de la cuenta de Apple
 * Developer de Gyoza Studio, 10 caracteres alfanuméricos: App Store Connect →
 * Membership details). Mientras no esté definida devolvemos 503 en lugar de un
 * fichero con un Team ID falso, que dejaría los enlaces rotos de forma silenciosa.
 *
 * Ver docs/capacitor.md para la configuración del lado de Xcode.
 */

// El Team ID se lee en cada petición: así basta con añadir la variable en Vercel
// sin necesidad de volver a desplegar el código.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Identificador de paquete acordado, igual que `appId` en capacitor.config.ts. */
const BUNDLE_ID = "app.bgplanner";

/**
 * Rutas que deben abrirse dentro de la app en lugar de en el navegador.
 * Cualquier otra URL del dominio (landing, changelog, legales…) se abre en Safari,
 * que es lo que queremos: solo capturamos lo que tiene pantalla propia en la app.
 */
const PATHS = [
  { path: "/groups/*", comment: "Grupos y sus pestañas" },
  { path: "/events/*", comment: "Eventos y sus pestañas" },
  { path: "/join/*", comment: "Invitación por código de grupo" },
  { path: "/join-event/*", comment: "Invitación por código de evento" },
  { path: "/invite/*", comment: "Invitación por token de email" },
  { path: "/profile*", comment: "Perfil propio y subrutas" },
];

export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;

  if (!teamId) {
    return NextResponse.json(
      { error: "APPLE_TEAM_ID no configurado" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const appId = `${teamId}.${BUNDLE_ID}`;

  const association = {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: PATHS.map(({ path, comment }) => ({
            "/": path,
            comment,
          })),
        },
      ],
    },
    // Permite al llavero de iOS autocompletar credenciales del dominio dentro de
    // la app (y viceversa). Inofensivo aunque hoy el login sea solo OTP por email.
    webcredentials: {
      apps: [appId],
    },
  };

  return NextResponse.json(association, {
    headers: {
      // Apple exige application/json exacto; NextResponse.json ya lo pone, pero lo
      // dejamos explícito porque es el motivo nº 1 de fallo de los Universal Links.
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
