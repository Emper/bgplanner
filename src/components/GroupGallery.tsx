"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Avatar from "./Avatar";
import { resizeImageToBlob } from "@/lib/image";

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
interface GalleryPhoto {
  id: string;
  url: string;
  userId: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
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

const MAX_PER_UPLOAD = 10;

export default function GroupGallery({ groupId, currentUserId, isAdmin, reloadKey, onAddOpinion }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
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
      const [rv, ph] = await Promise.all([
        fetch(`/api/groups/${groupId}/reviews`),
        fetch(`/api/groups/${groupId}/gallery-photos`),
      ]);
      const rd = await rv.json();
      if (!rv.ok) throw new Error(rd.error || "Error al cargar la galería");
      setReviews(rd.reviews);
      const pd = await ph.json();
      if (ph.ok) setPhotos(pd.photos);
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

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files).slice(0, MAX_PER_UPLOAD)) {
        const blob = await resizeImageToBlob(f, 1600, 0.82);
        fd.append("file", blob, "foto.jpg");
      }
      const res = await fetch(`/api/groups/${groupId}/gallery-photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Error al subir las fotos");
      else setPhotos((prev) => [...data.photos, ...prev]);
    } catch {
      setError("Error al procesar las fotos");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (id: string) => {
    if (!confirm("¿Borrar esta foto?")) return;
    setDeletingPhoto(id);
    try {
      const res = await fetch(`/api/groups/${groupId}/gallery-photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al borrar");
      } else {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingPhoto(null);
    }
  };

  const handleDeleteReview = async (id: string) => {
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
  const photoList: Photo[] = photos.map((p) => ({ id: p.id, url: p.url }));

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
  } else if (reviews.length === 0 && photos.length === 0) {
    body = (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📷</p>
        <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
          Aún no hay nada en la galería
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sube una foto suelta o añade una opinión de cualquier juego.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-8">
        {/* Fotos sueltas */}
        {photos.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
              Fotos del grupo
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p, i) => {
                const canDelete = p.userId === currentUserId || isAdmin;
                return (
                  <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    <button onClick={() => setLightbox({ photos: photoList, index: i })} className="absolute inset-0">
                      <Image
                        src={p.url}
                        alt="Foto del grupo"
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 160px"
                      />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deletePhoto(p.id)}
                        disabled={deletingPhoto === p.id}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Borrar foto"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Opiniones */}
        {reviews.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
              Opiniones
            </h3>
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
                              onClick={() => handleDeleteReview(r.id)}
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
          </section>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <label
          className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer"
          style={{ border: "1px solid var(--border)", color: "var(--text)" }}
        >
          {uploading ? "Subiendo…" : "📷 Subir foto"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
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
              alt="Foto"
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
