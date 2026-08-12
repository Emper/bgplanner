"use client";

import Image from "next/image";

interface PlayedItem {
  groupGameId: string;
  game: { id: string; name: string; bggId: number; thumbnail: string | null };
  lastPlayedDate: string | null;
}

interface Props {
  games: PlayedItem[];
  isAdmin: boolean;
  onArchiveAll: () => void;
  onOpinion: (gameId: string, gameName: string) => void;
  onReturn: (gameId: string, gameName: string) => void;
  onArchive: (gameId: string, gameName: string) => void;
}

export default function GroupPlayedGames({
  games,
  isAdmin,
  onArchiveAll,
  onOpinion,
  onReturn,
  onArchive,
}: Props) {
  if (games.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🎲</p>
        <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
          Aún no habéis jugado nada
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Marca un juego como jugado desde el ranking y aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Ya jugados ({games.length})
        </h3>
        {isAdmin && (
          <button
            onClick={onArchiveAll}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          >
            Ocultar todo
          </button>
        )}
      </div>
      <div className="space-y-2">
        {games.map((item) => (
          <div
            key={item.groupGameId}
            className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3 transition-all duration-200"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)]">
                {item.game.thumbnail ? (
                  <Image src={item.game.thumbnail} alt={item.game.name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--text-secondary)] text-sm leading-tight">
                  <a
                    href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--primary)] transition-colors"
                  >
                    {item.game.name}
                  </a>
                </div>
              </div>
              <div className="text-right shrink-0">
                {item.lastPlayedDate ? (
                  <div className="text-xs text-[var(--text-muted)]">
                    {new Date(item.lastPlayedDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)]">—</div>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-3 mt-1.5 text-[11px]">
              <button
                onClick={() => onOpinion(item.game.id, item.game.name)}
                className="text-[var(--primary)] hover:opacity-80 transition-colors font-medium"
              >
                ✍️ Opinión
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => onReturn(item.game.id, item.game.name)}
                    className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                  >
                    Devolver al ranking
                  </button>
                  <button
                    onClick={() => onArchive(item.game.id, item.game.name)}
                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    Ocultar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
