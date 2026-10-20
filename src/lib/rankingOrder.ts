// El orden del ranking de un grupo, en un solo sitio: manda la suma de los
// votos y, si empatan, la nota de BGG. Sin dependencias para que lo use
// también el cliente al reordenar tras un voto.

export function voteScore(votes: { value: number }[]): number {
  return votes.reduce((acc, v) => acc + v.value, 0);
}

export function compareRanking(
  a: { score: number; game: { bggRating: number | null } },
  b: { score: number; game: { bggRating: number | null } }
): number {
  if (b.score !== a.score) return b.score - a.score;
  return (b.game.bggRating || 0) - (a.game.bggRating || 0);
}
