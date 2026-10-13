import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// El icono de "Añadir a pantalla de inicio" en iOS, que no acepta SVG: el
// mismo dibujo que favicon.svg, en PNG. Se pinta una vez en el build.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const font = await readFile(
    join(process.cwd(), "src/assets/fonts/bricolage-grotesque-latin-800-normal.woff")
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e293b",
          color: "#f59e0b",
          fontFamily: "Bricolage",
          fontSize: 120,
          fontWeight: 800,
        }}
      >
        P
      </div>
    ),
    { ...size, fonts: [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] }
  );
}
