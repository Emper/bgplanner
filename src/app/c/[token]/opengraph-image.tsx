import {
  collectionTagline,
  countOwnedGames,
  findCollectionOwner,
  pickShelfCovers,
} from "@/lib/collectionData";
import {
  inlineImage,
  shareCardResponse,
  SHARE_CARD_SIZE,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/shareCards";

// La tarjeta de una colección compartida usa la plantilla común, pero con
// la estantería en vez de una foto: una caja suelta parecía que compartías
// ese juego y no la ludoteca entera.
export const alt = "Colección de juegos en BG Planner";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

const COVERS = 5;

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const owner = await findCollectionOwner(token);

  // Enlace revocado o cuenta sin BGG: tarjeta genérica, sin contar nada.
  if (!owner?.bggUsername) {
    return shareCardResponse({
      title: "BG Planner",
      tagline: "Organiza las partidas de tu grupo de juegos de mesa.",
    });
  }

  const name = owner.displayName || owner.name || `@${owner.bggUsername}`;
  const [{ games, expansions }, urls] = await Promise.all([
    countOwnedGames(owner.bggUsername),
    pickShelfCovers(owner.id, owner.bggUsername, COVERS),
  ]);

  // Las portadas que no se puedan traer se caen solas y la balda sale con
  // las que haya; sin ninguna, la plantilla cae en su versión de siempre.
  const inlined = await Promise.all(urls.map((url) => inlineImage(url)));
  const covers = inlined.filter((src): src is string => src !== null);

  return shareCardResponse({
    eyebrow: "La colección de",
    title: name,
    badge: games > 0 ? `${games} juegos` : null,
    tagline: collectionTagline({ name, games, expansions }),
    shelf: covers,
  });
}
