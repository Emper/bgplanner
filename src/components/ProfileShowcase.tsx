"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GameShelf, { type ShelfGame } from "./GameShelf";
import { SectionCard } from "./ui/Card";

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
    <SectionCard
      className="mt-6"
      title="Mi vitrina"
      subtitle="Tus imprescindibles, los que enseñarías a cualquiera que entre en casa."
      action={
        <Link href="/collection" className="text-xs text-[var(--primary)] hover:underline">
          Editar
        </Link>
      }
    >
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
    </SectionCard>
  );
}
