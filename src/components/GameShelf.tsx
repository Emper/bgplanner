"use client";

import Image from "next/image";

export interface ShelfGame {
  bggId: number;
  name: string;
  image: string | null;
  thumbnail: string | null;
}

// La estantería de madera: cajas apoyadas en las baldas. La usan la vitrina
// del perfil propio y la del perfil público de cualquier jugador.
export default function GameShelf({
  games,
  compact = false,
}: {
  games: ShelfGame[];
  /** Baldas más bajas y cajas más juntas, para vitrinas de pocos juegos. */
  compact?: boolean;
}) {
  return (
    <div className={`shelf-wrap${compact ? " shelf-wrap--compact" : ""}`}>
      <div className={`shelf${compact ? " shelf--compact" : ""}`}>
        {games.map((game) => {
          const img = game.image || game.thumbnail;
          return (
            <div key={game.bggId} className="shelf-slot">
              <a
                href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shelf-item flex items-end justify-center max-w-full"
                title={game.name}
              >
                {img ? (
                  <Image
                    src={img}
                    alt={game.name}
                    width={220}
                    height={220}
                    sizes="(max-width: 640px) 33vw, 120px"
                    className="shelf-box"
                  />
                ) : (
                  <span className="shelf-box flex items-end justify-center w-16 h-20 bg-[var(--surface-hover)] text-2xl">
                    🎲
                  </span>
                )}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
