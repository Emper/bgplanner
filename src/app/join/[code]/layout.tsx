import type { Metadata } from "next";
import { getGroupByInviteCode, groupTagline } from "@/lib/publicLinks";

// El enlace de invitación es público por definición (quien lo recibe aún no
// tiene por qué tener cuenta), pero es una invitación, no un escaparate: que
// no acabe en un buscador.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);

  if (!group) {
    return {
      title: "Invitación no válida · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  const title = `Te invitan a ${group.name}`;
  const description = groupTagline(group);

  return {
    title: `${title} · BG Planner`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "BG Planner" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
