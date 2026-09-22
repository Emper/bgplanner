"use client";

import Image from "next/image";
import { KEEP_HEX, KEEP_LABELS } from "@/lib/collection";

export interface ShelfGame {
  bggId: number;
  name: string;
  image: string | null;
  thumbnail: string | null;
  /** Puntuación de permanencia. Sin ella, la caja no lleva chincheta. */
  keepScore?: number | null;
  /** Marca de vitrina. En la vitrina del perfil sobra: están todos. */
  showcased?: boolean;
}

// La estantería de madera: cajas apoyadas en las baldas. La usan la vitrina
// del perfil (propio y público) y la vista de estantería de una colección.
export default function GameShelf({
  games,
  onSelect,
  compact = false,
}: {
  games: ShelfGame[];
  /**
   * Qué hace una caja al pulsarla. Con `onSelect` abre su ficha dentro de
   * la app; sin él, la caja es un enlace a la página del juego en BGG.
   */
  onSelect?: (game: ShelfGame) => void;
  /** Baldas más bajas y cajas más juntas, para vitrinas de pocos juegos. */
  compact?: boolean;
}) {
  return (
    <div className={`shelf-wrap${compact ? " shelf-wrap--compact" : ""}`}>
      <div className={`shelf${compact ? " shelf--compact" : ""}`}>
        {games.map((game) => {
          const img = game.image || game.thumbnail;
          const title = game.keepScore
            ? `${game.name} — ${KEEP_LABELS[game.keepScore]}`
            : game.name;
          const className =
            "shelf-item relative flex items-end justify-center max-w-full focus:outline-none";

          const box = (
            <>
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
              {game.keepScore ? (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white/70 shadow"
                  style={{ backgroundColor: KEEP_HEX[game.keepScore] }}
                />
              ) : null}
              {game.showcased && (
                <span className="absolute -top-2 -left-1 text-xs drop-shadow">⭐</span>
              )}
            </>
          );

          return (
            <div key={game.bggId} className="shelf-slot">
              {onSelect ? (
                <button
                  onClick={() => onSelect(game)}
                  className={className}
                  title={title}
                >
                  {box}
                </button>
              ) : (
                <a
                  href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  title={title}
                >
                  {box}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
