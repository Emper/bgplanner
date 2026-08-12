"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Avatar from "./Avatar";

interface Photo {
  id: string;
  url: string;
}
interface Review {
  id: string;
  rating: number | null;
  text: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
  photos: Photo[];
  session: { id: string; name: string | null; date: string } | null;
  game: { gameId: string; bggId: number; name: string; thumbnail: string | null };
}

interface Props {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
  reloadKey: number;
  onAddOpinion: (gameId: string, gameName: string) => void;
}

// Juego tal como lo devuelve GET /api/groups/[id]/games (incluye archivados).
interface PickerGame {
  game: { id: string; name: string; thumbnail: string | null };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function GroupGallery({ groupId, currentUserId, isAdmin, reloadKey, onAddOpinion }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);

  // Selector de juego para "Añadir opinión"
  const [pickerOpen, setPickerOpen] = useState(false);
  const [games, setGames] = useState<PickerGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gameSearch, setGameSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/reviews`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar la galería");
      setReviews(data.reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const openPicker = async () => {
    setPickerOpen(true);
    setGameSearch("");
    if (games.length === 0) {
      setGamesLoading(true);
      try {
        const res = await fetch(`/api/groups/${groupId}/games`);
        const data = await res.json();
        if (res.ok) setGames(data);
      } finally {
        setGamesLoading(false);
      }
    }
  };

  const pickGame = (g: PickerGame) => {
    setPickerOpen(false);
    onAddOpinion(g.game.id, g.game.name);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar esta opinión y sus fotos?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/groups/${groupId}/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al borrar");
      } else {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  const filteredGames = games.filter((g) =>
    g.game.name.toLowerCase().includes(gameSearch.trim().toLowerCase())
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
        Cargando galería…
      </p>
    );
  } else if (error) {
    body = (
      <p className="text-center py-12 text-sm" style={{ color: "#ef4444" }}>
        {error}
      </p>
    );
  } else if (reviews.length === 0) {
    body = (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📷</p>
        <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
          Aún no hay opiniones
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Añade una opinión de cualquier juego: nota, comentario y fotos.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        {reviews.map((r) => {
          const authorName = r.user.displayName || r.user.name || "Alguien";
          const canDelete = r.userId === currentUserId || isAdmin;
          return (
            <div
              key={r.id}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
            >
              <div className="flex items-start gap-3">
                <Avatar name={authorName} avatarUrl={r.user.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm" style={{ color: "var(--text)" }}>
                      <span className="font-semibold">{authorName}</span>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        en <span className="font-medium">{r.game.name}</span>
                      </span>
                    </p>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="text-xs shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {deleting === r.id ? "…" : "Borrar"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(r.createdAt)}
                  </p>
                  {r.rating != null && r.rating > 0 && (
                    <p className="text-base mt-1" style={{ color: "#f59e0b" }}>
                      {"★".repeat(r.rating)}
                      <span style={{ color: "var(--border)" }}>{"★".repeat(5 - r.rating)}</span>
                    </p>
                  )}
                  {r.text && (
                    <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                      {r.text}
                    </p>
                  )}
                  {r.photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                      {r.photos.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => setLightbox({ photos: r.photos, index: i })}
                          className="relative aspect-square rounded-xl overflow-hidden"
                        >
                          <Image
                            src={p.url}
                            alt="Foto de la partida"
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="(max-width: 640px) 33vw, 160px"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openPicker}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#f59e0b", color: "#0f172a" }}
        >
          ✍️ Añadir opinión
        </button>
      </div>

      {body}

      {/* Selector de juego */}
      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}>
              ¿Sobre qué juego?
            </h3>
            <input
              autoFocus
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Buscar juego…"
              className="w-full rounded-xl p-2.5 mb-3 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
            />
            <div className="overflow-y-auto -mx-1 px-1">
              {gamesLoading ? (
                <p className="text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>
                  Cargando juegos…
                </p>
              ) : filteredGames.length === 0 ? (
                <p className="text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>
                  No hay juegos que coincidan.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredGames.map((g) => (
                    <button
                      key={g.game.id}
                      onClick={() => pickGame(g)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)]">
                        {g.game.thumbnail && (
                          <Image src={g.game.thumbnail} alt={g.game.name} width={36} height={36} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-sm" style={{ color: "var(--text)" }}>
                        {g.game.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
          {lightbox.photos.length > 1 && (
            <button
              className="absolute left-4 text-white text-4xl leading-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) =>
                  lb
                    ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length }
                    : lb
                );
              }}
              aria-label="Anterior"
            >
              ‹
            </button>
          )}
          <div
            className="relative w-full max-w-3xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.photos[lightbox.index].url}
              alt="Foto de la partida"
              fill
              unoptimized
              className="object-contain"
              sizes="100vw"
            />
          </div>
          {lightbox.photos.length > 1 && (
            <button
              className="absolute right-4 text-white text-4xl leading-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) =>
                  lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : lb
                );
              }}
              aria-label="Siguiente"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
