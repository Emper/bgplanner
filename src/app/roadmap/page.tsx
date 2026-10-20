import { getSession } from "@/lib/auth";
import { getRoadmapFeatures } from "@/lib/roadmap";
import RoadmapClient from "./RoadmapClient";

// Las propuestas salen pintadas del servidor (los buscadores las ven) y con
// los votos propios ya marcados si hay sesión.
export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const session = await getSession();
  const features = await getRoadmapFeatures(session?.userId ?? null);
  return <RoadmapClient initialFeatures={features} isLoggedIn={!!session} />;
}
