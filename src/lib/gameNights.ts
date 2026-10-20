import type { Prisma } from "@prisma/client";

// Lo que se pinta de cada noche en la ficha del grupo (dashboard y API).
export const GAME_NIGHT_INCLUDE = {
  createdBy: { select: { id: true, name: true, displayName: true } },
  players: {
    select: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
    },
  },
  games: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      game: {
        select: { id: true, bggId: true, name: true, thumbnail: true, playingTime: true },
      },
    },
  },
} satisfies Prisma.GameNightInclude;
