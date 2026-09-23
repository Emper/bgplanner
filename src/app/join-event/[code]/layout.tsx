import type { Metadata } from "next";
import { getEventByInviteCode, formatEventWhen } from "@/lib/publicLinks";

// Invitación a un evento. Vale igual para los privados —quien recibe el
// enlace está invitado— y por eso no se indexa.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const event = await getEventByInviteCode(code);

  if (!event) {
    return {
      title: "Invitación no válida · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  const title = `Te invitan a ${event.name}`;
  const description = `${formatEventWhen(event.date)}${
    event.location ? ` en ${event.location}` : ""
  }. Apúntate en BG Planner.`;

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
