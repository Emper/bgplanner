import { ImageResponse } from "next/og";

// La tarjeta que se ve al pegar un enlace de BG Planner en WhatsApp,
// Telegram, Slack o X. Una sola plantilla para perfiles, grupos, eventos e
// invitaciones: cambian la foto, el título y la frase, no el aspecto.

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };
export const SHARE_CARD_CONTENT_TYPE = "image/png";

// Colores de la app (los mismos del tema oscuro y de los emails).
const BG = "#0f172a";
const SURFACE = "#1e293b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const ACCENT = "#f59e0b";
const BORDER = "#334155";

/** Para tarjetas con diseño propio (la de la portada) que no usan la plantilla. */
export const SHARE_COLORS = { BG, SURFACE, TEXT, MUTED, ACCENT, BORDER };

// La madera de la estantería, en su versión oscura (globals.css).
const WOOD_BACK = "#3f2f24";
const WOOD = "#8a5a33";
const WOOD_DARK = "#5e3b20";
const COVER_W = 150;
const COVER_H = 172;

/**
 * Trae una imagen externa y la incrusta en base64.
 *
 * Las fotos de Supabase hay que resolverlas ANTES de dibujar: si se
 * resolvieran durante el dibujado, un fallo de red reventaría el PNG a media
 * emisión, y ahí ya no hay try/catch que valga. Lo que ya viene en base64
 * (las fotos subidas desde el móvil) se usa tal cual.
 */
export async function inlineImage(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (!url.startsWith("http")) return null;

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

export interface ShareCardInput {
  /** Línea pequeña sobre el título: "Te invitan al grupo", "Evento"… */
  eyebrow?: string | null;
  title: string;
  /** Píldora bajo el título: el usuario de BGG, la fecha del evento… */
  badge?: string | null;
  /** Píldora verde en vez de gris (BGG). */
  badgeTone?: "accent" | "bgg";
  /** Línea discreta bajo el título: de dónde es, por ejemplo. */
  subtitle?: string | null;
  /** Frase de presentación, la misma que la descripción del enlace. */
  tagline: string;
  /**
   * Cifras grandes en vez de la frase ("120 juegos", "3 grupos"…). Las usa
   * el perfil, que así presume de lo que lleva hecho de un vistazo.
   */
  stats?: { value: string; label: string }[];
  /** Foto ya incrustada con inlineImage(). */
  image?: string | null;
  /** Foto redonda (personas) o con esquinas (eventos, grupos). */
  round?: boolean;
  /**
   * Portadas ya incrustadas para pintar la estantería en vez de una sola
   * foto. Lo usa la colección compartida: una caja suelta parecía que
   * compartías ese juego y no la ludoteca entera.
   */
  shelf?: string[];
}

// Sin foto, la inicial. Nada de emojis: satori no trae fuente que los
// dibuje y saldrían como un cuadrado vacío, y traérsela de un CDN al vuelo
// es justo la dependencia de red que esta tarjeta evita.
function Media({
  image,
  initial,
  round,
  side,
}: {
  image?: string | null;
  initial: string;
  round: boolean;
  side: number;
}) {
  const radius = round ? side / 2 : 36;
  const common = {
    width: side,
    height: side,
    borderRadius: radius,
    border: `6px solid ${ACCENT}`,
  };

  if (image) {
    return (
      // Esto lo dibuja satori dentro de un PNG: no hay DOM, ni next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={side}
        height={side}
        style={{ ...common, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      style={{
        ...common,
        background: SURFACE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: side * 0.46,
        fontWeight: 700,
        color: ACCENT,
      }}
    >
      {initial}
    </div>
  );
}

// La estantería de la app, reducida a una balda con sus cajas encima.
function Shelf({ covers }: { covers: string[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: WOOD_BACK,
        borderRadius: 16,
        paddingTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 20,
          height: COVER_H,
          padding: "0 24px",
        }}
      >
        {covers.map((src, i) => (
          // Esto lo dibuja satori dentro de un PNG: no hay DOM, ni next/image.
          // eslint-disable-next-line @next/next/no-img-element
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
  );
}

export function shareCard({
  eyebrow,
  title,
  subtitle,
  badge,
  badgeTone = "accent",
  tagline,
  stats,
  image,
  shelf,
  round = false,
}: ShareCardInput) {
  const initial = (title[0] || "?").toUpperCase();
  // Con estantería, el título ocupa todo el ancho y las cajas van debajo;
  // sin ella, la plantilla de siempre con la foto al lado.
  const hasShelf = !!shelf && shelf.length > 0;
  // Con cifras, la foto encoge un poco para dejarles sitio debajo.
  const hasStats = !hasShelf && !!stats && stats.length > 0;

  const eyebrowEl = eyebrow ? (
    <div
      style={{
        fontSize: 30,
        color: ACCENT,
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: hasShelf ? 10 : 14,
      }}
    >
      {eyebrow}
    </div>
  ) : null;

  const titleEl = (
    <div
      style={{
        fontSize: title.length > 24 ? 56 : 72,
        fontWeight: 700,
        color: TEXT,
        lineHeight: 1.1,
        maxWidth: 700,
      }}
    >
      {title}
    </div>
  );

  const subtitleEl = subtitle ? (
    <div style={{ fontSize: 34, color: MUTED, marginTop: 10 }}>{subtitle}</div>
  ) : null;

  const badgeEl = badge ? (
    <div
      style={{
        fontSize: 30,
        borderRadius: 999,
        padding: "8px 24px",
        flexShrink: 0,
        ...(badgeTone === "bgg"
          ? {
              color: "#6ee7b7",
              background: "rgba(16, 185, 129, 0.12)",
              border: "2px solid rgba(16, 185, 129, 0.35)",
            }
          : {
              color: ACCENT,
              background: "rgba(245, 158, 11, 0.12)",
              border: "2px solid rgba(245, 158, 11, 0.35)",
            }),
      }}
    >
      {badge}
    </div>
  ) : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        padding: hasShelf ? "48px 72px" : hasStats ? "52px 80px" : "70px 80px",
        fontFamily: "sans-serif",
      }}
    >
      {hasShelf ? (
        // Con estantería no hay foto que poner al lado, así que el nombre
        // ocupa la fila entera y el badge se va al extremo derecho. Debajo
        // solo caben las cajas: cualquier cosa más y se amontona todo.
        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrowEl}
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 32,
            }}
          >
            {titleEl}
            {badgeEl}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <Media
            image={image}
            initial={initial}
            round={round}
            side={hasStats ? 210 : 260}
          />
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            {eyebrowEl}
            {titleEl}
            {subtitleEl}
            {badgeEl ? (
              <div style={{ display: "flex", marginTop: 20 }}>{badgeEl}</div>
            ) : null}
          </div>
        </div>
      )}

      {hasShelf ? <Shelf covers={shelf!} /> : null}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {hasStats ? (
          // Cuatro cifras como mucho: con más, los números dejan de leerse
          // en la miniatura de WhatsApp.
          <div style={{ display: "flex", gap: 20 }}>
            {stats!.slice(0, 4).map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  background: SURFACE,
                  border: `2px solid ${BORDER}`,
                  borderRadius: 20,
                  padding: "14px 26px",
                }}
              >
                <div
                  style={{
                    fontSize: 60,
                    fontWeight: 700,
                    color: ACCENT,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 28, color: MUTED, marginTop: 6 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: hasShelf ? 32 : 38,
              color: MUTED,
              lineHeight: 1.35,
            }}
          >
            {tagline}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: hasShelf ? 20 : hasStats ? 28 : 36,
            paddingTop: hasShelf ? 20 : hasStats ? 22 : 30,
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
}

/** La tarjeta ya empaquetada, con caché: los bots la piden muchas veces. */
export function shareCardResponse(input: ShareCardInput) {
  return new ImageResponse(shareCard(input), {
    ...SHARE_CARD_SIZE,
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
