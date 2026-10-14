import { renderAppIcon } from "@/lib/appIcon";

// El icono de "Añadir a pantalla de inicio" en iOS, que no acepta SVG: el
// mismo dibujo que favicon.svg, en PNG. Se pinta una vez en el build.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width);
}
