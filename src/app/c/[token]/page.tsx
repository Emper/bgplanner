import { notFound, permanentRedirect } from "next/navigation";
import { findCollectionOwner } from "@/lib/collectionData";

// Los enlaces de antes para compartir la colección. Ya no se crean: la
// colección cuelga del perfil y la permanencia la ven solo los amigos. Los
// que siguen circulando por WhatsApp llevan ahí; uno que se revocó, a nada.
export default async function SharedCollectionRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const owner = await findCollectionOwner(token);
  if (!owner) notFound();
  permanentRedirect(`/users/${encodeURIComponent(owner.slug || owner.id)}/collection`);
}
