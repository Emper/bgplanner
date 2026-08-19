import { NextResponse } from "next/server";

/**
 * Digital Asset Links — habilita los App Links de Android (equivalente al AASA de iOS).
 *
 * Se sirve en https://bgplanner.app/.well-known/assetlinks.json. Android lo verifica
 * al instalar la app: si la huella no cuadra, los enlaces se abren en el navegador
 * sin dar ningún error visible.
 *
 * Requiere ANDROID_CERT_SHA256 con la huella SHA-256 del certificado de firma, en
 * formato hexadecimal separado por dos puntos (AA:BB:CC:...). Admite VARIAS huellas
 * separadas por comas, que es lo habitual: hace falta la del certificado de subida
 * (upload key) y la que genera Play App Signing (Play Console → Configuración →
 * Integridad de la aplicación → Firma de apps).
 *
 * A diferencia de iOS, aquí no hay Team ID: la identidad la da el package name más
 * la huella. Ver docs/capacitor.md.
 */

// La huella se lee en cada petición: basta con añadir la variable en Vercel.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Identificador de paquete acordado, igual que `appId` en capacitor.config.ts. */
const PACKAGE_NAME = "app.bgplanner";

export async function GET() {
  const raw = process.env.ANDROID_CERT_SHA256;

  const fingerprints = (raw ?? "")
    .split(",")
    .map((fp) => fp.trim().toUpperCase())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return NextResponse.json(
      { error: "ANDROID_CERT_SHA256 no configurado" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const statements = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(statements, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
