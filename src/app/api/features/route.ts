import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRoadmapFeatures } from "@/lib/roadmap";

// Listado siempre fresco: sin esto, una CDN o el navegador pueden servir una
// versión anterior y esconder una propuesta recién publicada.
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Roadmap público: se puede leer sin sesión (para votar sí hace falta).
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  const features = await getRoadmapFeatures(session?.userId ?? null);
  return NextResponse.json({ isLoggedIn: !!session, features }, NO_STORE);
}
