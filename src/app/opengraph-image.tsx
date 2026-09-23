import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEMO_GAMES, type DemoGame } from "@/components/landing/games";
import {
  inlineImage,
  SHARE_CARD_CONTENT_TYPE,
  SHARE_CARD_SIZE,
  SHARE_COLORS,
} from "@/lib/shareCards";

// Esto lo dibuja satori dentro de un PNG: no hay DOM, ni next/image.
// La tarjeta de la portada: un recorte de la home, con el titular a la
// izquierda y el ranking en directo del grupo de muestra a la derecha. Vale
// también para las páginas que no traen tarjeta propia (changelog, login…).
// Sin emojis: satori no trae fuente que los dibuje, así que la estrella y
// las medallas van pintadas a mano. Las fuentes de la app (Bricolage y DM
// Sans, ambas OFL) van en el repo para no depender de la red al dibujar.

export const alt = "BG Planner: decide con tus amigos a qué jugar";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;
// Sin datos de la petición, así que Next la dibuja una vez en el build y la
// sirve estática: ni lee las fuentes ni pide carátulas a BGG en cada visita.

const { BG, SURFACE, TEXT, MUTED, ACCENT, BORDER } = SHARE_COLORS;
const SURFACE_ALT = "#172033";

const FONTS_DIR = join(process.cwd(), "src/assets/fonts");

async function loadFonts() {
  const [display, body, bodyBold] = await Promise.all([
    readFile(join(FONTS_DIR, "bricolage-grotesque-latin-800-normal.woff")),
    readFile(join(FONTS_DIR, "dm-sans-latin-400-normal.woff")),
    readFile(join(FONTS_DIR, "dm-sans-latin-700-normal.woff")),
  ]);
  return [
    { name: "Bricolage", data: display, weight: 800 as const, style: "normal" as const },
    { name: "DM Sans", data: body, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: bodyBold, weight: 700 as const, style: "normal" as const },
  ];
}

const DISPLAY = "Bricolage";

const ROWS: { game: DemoGame; pts: number; flash?: string }[] = [
  { game: DEMO_GAMES.brass, pts: 14 },
  { game: DEMO_GAMES.root, pts: 12, flash: "+3 Marta" },
  { game: DEMO_GAMES.arkNova, pts: 9 },
  { game: DEMO_GAMES.wyrmspan, pts: 7 },
  { game: DEMO_GAMES.viticulture, pts: 5 },
];

const MEDALS = [
  { bg: "linear-gradient(135deg, #fde68a, #f59e0b)", fg: "#78350f" },
  { bg: "linear-gradient(135deg, #f1f5f9, #94a3b8)", fg: "#334155" },
  { bg: "linear-gradient(135deg, #d97706, #92400e)", fg: "#fff7ed" },
];

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        fill={color}
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

function Die() {
  const pip = { width: 7, height: 7, borderRadius: 999, background: ACCENT };
  return (
    <div
      style={{
        display: "flex",
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "rgba(245, 158, 11, 0.16)",
        padding: 8,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={pip} />
        <div style={pip} />
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={pip} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={pip} />
        <div style={pip} />
      </div>
    </div>
  );
}

function Cover({ src, side }: { src: string | null; side: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      width={side}
      height={side}
      style={{ width: side, height: side, borderRadius: 10, objectFit: "cover" }}
    />
  ) : (
    <div style={{ display: "flex", width: side, height: side, borderRadius: 10, background: BORDER }} />
  );
}

function Pill({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 24,
        color: TEXT,
        padding: "8px 20px",
        borderRadius: 999,
        background: SURFACE,
        border: `2px solid ${BORDER}`,
      }}
    >
      {children}
    </div>
  );
}

export default async function Image() {
  const [covers, fonts] = await Promise.all([
    Promise.all(ROWS.map((r) => inlineImage(r.game.thumb))),
    loadFonts(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          fontFamily: "DM Sans",
          overflow: "hidden",
        }}
      >
        {/* Resplandor ámbar detrás del ranking */}
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -60,
            width: 820,
            height: 760,
            display: "flex",
            background: "radial-gradient(circle at center, rgba(245, 158, 11, 0.28), rgba(245, 158, 11, 0) 65%)",
          }}
        />

        {/* Izquierda: marca y titular */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 640,
            padding: "56px 0 52px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 40, fontFamily: DISPLAY, color: TEXT, letterSpacing: -1 }}>
              <span style={{ color: ACCENT }}>BG</span>
              <span>&nbsp;Planner</span>
            </div>
            <Die />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, fontFamily: DISPLAY, color: TEXT, lineHeight: 1, letterSpacing: -2.5 }}>
              ¿A qué jugamos
            </div>
            <div style={{ display: "flex", fontSize: 76, fontFamily: DISPLAY, color: ACCENT, lineHeight: 1.08, letterSpacing: -2.5 }}>
              esta noche?
            </div>
            <div style={{ display: "flex", fontSize: 27, color: MUTED, lineHeight: 1.4, marginTop: 22, maxWidth: 500 }}>
              Votad vuestros juegos de mesa y que el ranking decida. Con tu colección de BGG y eventos donde apuntarte.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Pill>Grupos</Pill>
              <Pill>Mi colección</Pill>
              <Pill>Eventos</Pill>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>bgplanner.app</span>
              <span>&nbsp;· Gratis y sin contraseñas</span>
            </div>
          </div>
        </div>

        {/* Derecha: el ranking del grupo de muestra, un poco ladeado */}
        <div
          style={{
            position: "absolute",
            right: 44,
            top: 70,
            width: 470,
            display: "flex",
            flexDirection: "column",
            borderRadius: 26,
            background: SURFACE,
            border: `2px solid ${BORDER}`,
            boxShadow: "0 40px 80px rgba(0, 0, 0, 0.55)",
            transform: "rotate(3deg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 18px",
              background: SURFACE_ALT,
              borderBottom: `2px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#fb7185" }} />
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#fbbf24" }} />
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#34d399" }} />
            <div
              style={{
                display: "flex",
                marginLeft: 12,
                fontSize: 17,
                color: MUTED,
                padding: "5px 14px",
                borderRadius: 8,
                background: BG,
              }}
            >
              bgplanner.app/groups/los-del-jueves
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 8px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 28, fontFamily: DISPLAY, color: TEXT, letterSpacing: -0.5 }}>Los del jueves</div>
              <div style={{ display: "flex", fontSize: 18, color: MUTED }}>5 jugadores · 212 juegos en la mesa</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#34d399", fontWeight: 700 }}>
              <div style={{ display: "flex", width: 11, height: 11, borderRadius: 999, background: "#10b981" }} />
              Votando ahora
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 16px", gap: 6 }}>
            {ROWS.map((row, i) => {
              const medal = MEDALS[i];
              const highlight = !!row.flash;
              return (
                <div
                  key={row.game.bggId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "8px 10px",
                    borderRadius: 16,
                    border: `2px solid ${highlight ? "rgba(245, 158, 11, 0.5)" : "transparent"}`,
                    background: highlight ? "rgba(245, 158, 11, 0.08)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      fontSize: 17,
                      fontWeight: 700,
                      background: medal ? medal.bg : "transparent",
                      color: medal ? medal.fg : MUTED,
                    }}
                  >
                    {i + 1}
                  </div>
                  <Cover src={covers[i]} side={52} />
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: TEXT }}>{row.game.name}</div>
                    <div style={{ display: "flex", fontSize: 16, color: MUTED }}>
                      {row.game.players} jugadores · {row.game.minutes} min
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {row.flash ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#ffffff",
                          background: "#f97316",
                          padding: "3px 9px",
                          borderRadius: 7,
                        }}
                      >
                        <Star size={15} color="#ffffff" />
                        {row.flash}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 4,
                        fontSize: 22,
                        fontWeight: 700,
                        color: TEXT,
                        padding: "4px 12px",
                        borderRadius: 10,
                        background: SURFACE_ALT,
                      }}
                    >
                      {row.pts}
                      <span style={{ fontSize: 14, color: MUTED, fontWeight: 400 }}>pts</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    ),
    {
      ...SHARE_CARD_SIZE,
      fonts,
    }
  );
}
