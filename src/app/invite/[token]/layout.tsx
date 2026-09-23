import type { Metadata } from "next";
import { getGroupByInviteToken, groupTagline } from "@/lib/publicLinks";

// Invitación nominal, la que sale por email. Igual que /join: pública para
// quien la recibe, fuera de los buscadores.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const group = await getGroupByInviteToken(token);

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
