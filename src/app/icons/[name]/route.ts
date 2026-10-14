import { renderAppIcon, type AppIconVariant } from "@/lib/appIcon";

// Iconos PNG de la PWA (manifest y notificaciones push). Se pintan en el
// build: los nombres posibles son fijos.
const ICONS: Record<string, { size: number; variant: AppIconVariant }> = {
  "icon-192.png": { size: 192, variant: "app" },
  "icon-512.png": { size: 512, variant: "app" },
  "icon-maskable-512.png": { size: 512, variant: "maskable" },
  "badge-96.png": { size: 96, variant: "badge" },
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS[name];
  if (!icon) return new Response("Not found", { status: 404 });
  return renderAppIcon(icon.size, icon.variant);
}
