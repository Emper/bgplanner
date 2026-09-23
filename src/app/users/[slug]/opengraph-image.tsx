import { ImageResponse } from "next/og";
import { getProfileHeader, profileTagline } from "@/lib/publicProfile";

// La tarjeta que se ve al pegar el enlace del perfil en WhatsApp, Telegram,
// Slack o X. La pintamos nosotros en vez de mandar el avatar a pelo porque
// las fotos subidas desde el móvil se guardan como data URL, y eso no vale
// como og:image — aquí sí, porque acaba dentro de la imagen que generamos.
export const alt = "Perfil en BG Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colores de la app (los mismos del tema oscuro y de los emails).
const BG = "#0f172a";
const SURFACE = "#1e293b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const ACCENT = "#f59e0b";
const BORDER = "#334155";

// Las fotos que viven en Supabase las traemos nosotros y las incrustamos: si
// se resolvieran al pintar, un fallo de red reventaría el PNG a media emisión
// (y ahí ya no hay try/catch que valga). Las subidas desde el móvil ya vienen
// en base64 y se usan tal cual.
async function inlineAvatar(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (!avatarUrl.startsWith("http")) return null;

  try {
    const res = await fetch(avatarUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const header = await getProfileHeader(slug);
  const avatar = await inlineAvatar(header?.avatarUrl ?? null);

  const displayName = header?.displayName ?? "BG Planner";
  const tagline = header
    ? profileTagline(header)
    : "Organiza las partidas de tu grupo de juegos de mesa.";
  const initial = (displayName[0] || "?").toUpperCase();

  const card = (avatarUrl: string | null) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        padding: "70px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            width={260}
            height={260}
            style={{
              width: 260,
              height: 260,
              borderRadius: 130,
              objectFit: "cover",
              border: `6px solid ${ACCENT}`,
            }}
          />
        ) : header ? (
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 130,
              background: SURFACE,
              border: `6px solid ${ACCENT}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 120,
              fontWeight: 700,
              color: ACCENT,
            }}
          >
            {initial}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: TEXT,
              lineHeight: 1.1,
            }}
          >
            {displayName}
          </div>
          {header?.bggUsername ? (
            <div style={{ display: "flex", marginTop: 20 }}>
              <div
                style={{
                  fontSize: 30,
                  color: "#6ee7b7",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "2px solid rgba(16, 185, 129, 0.35)",
                  borderRadius: 999,
                  padding: "8px 24px",
                }}
              >
                {`@${header.bggUsername} en BGG`}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 38, color: MUTED, lineHeight: 1.35 }}>
          {tagline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 36,
            paddingTop: 30,
            borderTop: `2px solid ${BORDER}`,
          }}
        >
          <div style={{ fontSize: 34, color: ACCENT, fontWeight: 700 }}>
            BG Planner
          </div>
          <div style={{ fontSize: 30, color: MUTED }}>· bgplanner.app</div>
        </div>
      </div>
    </div>
  );

  // Sin foto utilizable, la tarjeta sale con la inicial: mejor eso que
  // quedarse sin vista previa.
  return new ImageResponse(card(avatar), {
    ...size,
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
