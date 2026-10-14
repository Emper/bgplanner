import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// El dibujo del icono de la app (la «P» ámbar de favicon.svg) en PNG, para
// los sitios que no aceptan SVG: iOS, el manifest de la PWA y los avisos.
//
// - "app": la P sobre su fondo, a sangre (iOS y Android le ponen las esquinas).
// - "maskable": igual, pero con la P dentro de la zona segura del 80 % para
//   que Android pueda recortarla en círculo, gota o lo que toque.
// - "badge": solo la silueta en blanco sobre transparente. Es el iconito de
//   la barra de estado de Android, que lo pinta monocromo.
export type AppIconVariant = "app" | "maskable" | "badge";

const BG = "#1e293b";
const FG = "#f59e0b";

export async function renderAppIcon(size: number, variant: AppIconVariant = "app") {
  const font = await readFile(
    join(process.cwd(), "src/assets/fonts/bricolage-grotesque-latin-800-normal.woff")
  );
  const scale = variant === "maskable" ? 0.5 : variant === "badge" ? 0.8 : 0.67;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: variant === "badge" ? "transparent" : BG,
          color: variant === "badge" ? "#ffffff" : FG,
          fontFamily: "Bricolage",
          fontSize: Math.round(size * scale),
          fontWeight: 800,
        }}
      >
        P
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Bricolage", data: font, weight: 800, style: "normal" }],
    }
  );
}
