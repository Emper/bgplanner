import { ImageResponse } from "next/og";
import {
  countOwnedGames,
  findCollectionOwner,
  pickShelfCovers,
} from "@/lib/collectionData";

// La tarjeta que se ve al pegar el enlace de una colección compartida en
// WhatsApp, Telegram, Slack o X. Pintamos nuestra estantería con cinco
// cajas en lugar de mandar una portada suelta, que parecía que estabas
// compartiendo ese juego en concreto y no tu ludoteca.
export const alt = "Colección de juegos en BG Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Los mismos colores que la tarjeta del perfil.
const BG = "#0f172a";
const SURFACE = "#1e293b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const ACCENT = "#f59e0b";
const BORDER = "#334155";

// La madera de la estantería, en su versión oscura (globals.css).
const WOOD_BACK = "#3f2f24";
const WOOD = "#8a5a33";
const WOOD_DARK = "#5e3b20";

const COVERS = 5;
const COVER_W = 168;
const COVER_H = 196;

// Igual que en la tarjeta del perfil: las portadas se traen y se incrustan
// antes de pintar. Si se resolvieran durante el dibujado, un fallo de red
// reventaría el PNG a media emisión, donde ya no hay try/catch que valga.
async function inlineImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const owner = await findCollectionOwner(token);

  let title = "Una colección en BG Planner";
  let subtitle = "Organiza las partidas de tu grupo de juegos de mesa.";
  let covers: string[] = [];

  if (owner?.bggUsername) {
    const [{ games, expansions }, urls] = await Promise.all([
      countOwnedGames(owner.bggUsername),
      pickShelfCovers(owner.id, owner.bggUsername, COVERS),
    ]);

    title = owner.displayName || owner.name || `@${owner.bggUsername}`;
    subtitle =
      games > 0
        ? `${plural(games, "juego", "juegos")}${
            expansions > 0
              ? ` y ${plural(expansions, "expansión", "expansiones")}`
              : ""
          } en su estantería`
        : "Su estantería en BG Planner";

    const inlined = await Promise.all(urls.map(inlineImage));
    covers = inlined.filter((src): src is string => src !== null);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "56px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              letterSpacing: 4,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            {owner ? "La colección de juegos de" : "BG Planner"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              color: TEXT,
              lineHeight: 1.1,
              marginTop: 10,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{ display: "flex", fontSize: 34, color: ACCENT, marginTop: 14 }}
          >
            {subtitle}
          </div>
        </div>

        {/* La estantería: las cajas apoyadas sobre la balda. */}
        {covers.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: WOOD_BACK,
              borderRadius: 16,
              padding: "20px 28px 0 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 22,
                height: COVER_H,
              }}
            >
              {covers.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={COVER_W}
                  height={COVER_H}
                  style={{
                    width: COVER_W,
                    height: COVER_H,
                    objectFit: "cover",
                    borderRadius: 4,
                    boxShadow: "0 10px 16px rgba(0, 0, 0, 0.55)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                height: 14,
                marginTop: 8,
                background: `linear-gradient(to bottom, ${WOOD}, ${WOOD_DARK})`,
                borderRadius: 2,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 230,
              borderRadius: 16,
              background: SURFACE,
              border: `2px solid ${BORDER}`,
              fontSize: 38,
              color: MUTED,
            }}
          >
            🎲
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 26,
            borderTop: `2px solid ${BORDER}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 34, color: ACCENT, fontWeight: 700 }}>
            BG Planner
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
            · bgplanner.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
