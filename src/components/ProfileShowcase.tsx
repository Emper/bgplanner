"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ShowcaseGame {
  bggId: number;
  name: string;
  image: string | null;
  thumbnail: string | null;
}

// La vitrina del perfil: los juegos que el dueño ha marcado como favoritos
// desde "Mi colección", apoyados en la misma estantería. No enseña la
// puntuación de permanencia, que es privada.
export default function ProfileShowcase() {
  const [games, setGames] = useState<ShowcaseGame[] | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    fetch("/api/collection?showcase=true", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return setGames([]);
        setConnected(!!data.connected);
        const items: ShowcaseGame[] = [...(data.items ?? [])].sort(
          (a: ShowcaseGame, b: ShowcaseGame) => a.name.localeCompare(b.name)
        );
        setGames(items);
      })
      .catch(() => setGames([]));
  }, []);

  if (games === null || !connected) return null;

  return (
    <div className="mt-6 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Mi vitrina</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Tus imprescindibles, los que enseñarías a cualquiera que entre en
            casa.
          </p>
        </div>
        <Link
          href="/collection"
          className="shrink-0 text-xs text-[var(--primary)] hover:underline"
        >
          Editar
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Todavía no has puesto nada.{" "}
          <Link href="/collection" className="text-[var(--primary)] hover:underline">
            Elige tus favoritos en Mi colección
          </Link>{" "}
          y aparecerán aquí.
        </p>
      ) : (
        <div className="shelf-wrap">
          <div className="shelf">
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
      )}
    </div>
  );
}
