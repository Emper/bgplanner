"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GameShelf, { type ShelfGame } from "./GameShelf";

// La vitrina del perfil: los juegos que el dueño ha marcado como favoritos
// desde "Mi colección", apoyados en la misma estantería. No enseña la
// puntuación de permanencia, que es privada.
export default function ProfileShowcase() {
  const [games, setGames] = useState<ShelfGame[] | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    fetch("/api/collection?showcase=true", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return setGames([]);
        setConnected(!!data.connected);
        const items: ShelfGame[] = [...(data.items ?? [])].sort(
          (a: ShelfGame, b: ShelfGame) => a.name.localeCompare(b.name)
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
        <GameShelf games={games} compact />
      )}
    </div>
  );
}
