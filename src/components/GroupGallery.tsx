"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Avatar from "./Avatar";
import { MoreMenu, ReportModal } from "./Moderation";
import { resizeImageToBlob } from "@/lib/image";
import { formatDateShort } from "@/lib/format";
import { displayName } from "@/lib/users";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Modal from "./ui/Modal";
import Button, { buttonClass, IconButton } from "./ui/Button";
import { Input } from "./ui/Field";
import { useConfirm } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";
import { EmptyState } from "./ui/EmptyState";
import Spinner, { InlineLoading } from "./ui/Spinner";
import GameThumb from "./ui/GameThumb";
import { cardClass, SectionLabel } from "./ui/Card";

interface Photo {
  id: string;
  url: string;
  /** Quien la subió (solo en las fotos sueltas). */
  userId?: string;
}
interface Review {
  id: string;
  rating: number | null;
  text: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
  photos: Photo[];
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

const MAX_PER_UPLOAD = 10;

export default function GroupGallery({ groupId, currentUserId, isAdmin, reloadKey, onAddOpinion }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  // `review`: las fotos son de esa opinión (y lo que se denuncia es la opinión)
  const [lightbox, setLightbox] = useState<{
    photos: Photo[];
    index: number;
    review?: { id: string; userId: string };
  } | null>(null);
  const [reporting, setReporting] = useState<{ type: "group_photo" | "review"; id: string } | null>(null);

  // Selector de juego para "Añadir opinión"
  const [pickerOpen, setPickerOpen] = useState(false);
  const [games, setGames] = useState<PickerGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gameSearch, setGameSearch] = useState("");
  const confirm = useConfirm();
  const toast = useToast();

  // El visor se cierra con Escape (si no hay una denuncia abierta encima).
  useEscapeKey(() => setLightbox(null), !!lightbox && !reporting);

  // Al recargar (cuando cambia `reloadKey`) no se vuelve a «Cargando…»: se
  // refresca en el sitio.
  const load = useCallback(
    () =>
      Promise.all([
        fetch(`/api/groups/${groupId}/reviews`).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error al cargar la galería");
          return data;
        }),
        fetch(`/api/groups/${groupId}/gallery-photos`).then((res) => (res.ok ? res.json() : null)),
      ])
        .then(([rd, pd]) => {
          setError("");
          setReviews(rd.reviews);
          if (pd) setPhotos(pd.photos);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Error"))
        .finally(() => setLoading(false)),
    [groupId]
  );

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
    if (!(await confirm({ title: "¿Borrar esta foto?", confirmLabel: "Borrar", tone: "danger" }))) return;
    setDeletingPhoto(id);
    try {
      const res = await fetch(`/api/groups/${groupId}/gallery-photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al borrar");
      } else {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingPhoto(null);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!(await confirm({ title: "¿Borrar esta opinión y sus fotos?", confirmLabel: "Borrar", tone: "danger" }))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/groups/${groupId}/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al borrar");
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
  const photoList: Photo[] = photos.map((p) => ({ id: p.id, url: p.url, userId: p.userId }));

  // Lo que se puede denunciar desde el visor: la foto suelta o la opinión
  // entera, siempre que no sea tuya.
  const lightboxPhoto = lightbox ? lightbox.photos[lightbox.index] : null;
  const lightboxReport: { type: "group_photo" | "review"; id: string } | null = !lightbox
    ? null
    : lightbox.review
      ? lightbox.review.userId !== currentUserId
        ? { type: "review", id: lightbox.review.id }
        : null
      : lightboxPhoto?.userId && lightboxPhoto.userId !== currentUserId
        ? { type: "group_photo", id: lightboxPhoto.id }
        : null;

  let body: ReactNode;
  if (loading) {
    body = <InlineLoading text="Cargando galería…" className="py-12" />;
  } else if (error) {
    body = <p className="text-center py-12 text-sm text-[var(--danger)]">{error}</p>;
  } else if (reviews.length === 0 && photos.length === 0) {
    body = (
      <EmptyState
        icon="📷"
        title="Aún no hay nada en la galería"
        description="Sube una foto suelta o añade una opinión de cualquier juego."
        className="py-16"
      />
    );
  } else {
    body = (
      <div className="space-y-8">
        {/* Fotos sueltas */}
        {photos.length > 0 && (
          <section>
            <SectionLabel>Fotos del grupo</SectionLabel>
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
            <SectionLabel>Opiniones</SectionLabel>
            <div className="space-y-4">
              {reviews.map((r) => {
                const authorName = displayName(r.user, "Alguien");
                const canDelete = r.userId === currentUserId || isAdmin;
                return (
                  <div key={r.id} className={cardClass({ padding: "none", className: "p-4" })}>
                    <div className="flex items-start gap-3">
                      <Avatar name={authorName} avatarUrl={r.user.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-[var(--text)]">
                            <span className="font-semibold">{authorName}</span>{" "}
                            <span className="text-[var(--text-secondary)]">
                              en <span className="font-medium">{r.game.name}</span>
                            </span>
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteReview(r.id)}
                                disabled={deleting === r.id}
                                className="text-xs shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                              >
                                {deleting === r.id ? "…" : "Borrar"}
                              </button>
                            )}
                            {r.userId !== currentUserId && (
                              <MoreMenu
                                className="-my-1.5 -mr-1.5"
                                items={[
                                  { label: "🚩 Denunciar opinión", onClick: () => setReporting({ type: "review", id: r.id }) },
                                ]}
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">{formatDateShort(r.createdAt)}</p>
                        {r.rating != null && r.rating > 0 && (
                          <p className="text-base mt-1 text-[var(--primary)]">
                            {"★".repeat(r.rating)}
                            <span className="text-[var(--border)]">{"★".repeat(5 - r.rating)}</span>
                          </p>
                        )}
                        {r.text && <p className="text-sm mt-1 whitespace-pre-wrap text-[var(--text)]">{r.text}</p>}
                        {r.photos.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                            {r.photos.map((p, i) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  setLightbox({ photos: r.photos, index: i, review: { id: r.id, userId: r.userId } })
                                }
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
          className={buttonClass({
            variant: "secondary",
            className: uploading ? "opacity-60 cursor-wait" : "cursor-pointer",
          })}
        >
          {uploading ? (
            <>
              <Spinner size="sm" tone="current" />
              Subiendo…
            </>
          ) : (
            "📷 Subir foto"
          )}
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
        <Button onClick={openPicker} disabled={uploading}>
          ✍️ Añadir opinión
        </Button>
      </div>

      {uploading && (
        <div className="flex items-center justify-center gap-2 mb-4 py-3 rounded-xl text-sm bg-[var(--surface)] text-[var(--text-secondary)]">
          <Spinner size="sm" tone="current" />
          Subiendo fotos…
        </div>
      )}

      {body}

      {/* Selector de juego */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="¿Sobre qué juego?">
        <Input
          value={gameSearch}
          onChange={(e) => setGameSearch(e.target.value)}
          placeholder="Buscar juego…"
          className="mb-3"
        />
        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {gamesLoading ? (
            <InlineLoading text="Cargando juegos…" className="py-6" />
          ) : filteredGames.length === 0 ? (
            <p className="text-center py-6 text-sm text-[var(--text-muted)]">No hay juegos que coincidan.</p>
          ) : (
            <div className="space-y-1">
              {filteredGames.map((g) => (
                <button
                  key={g.game.id}
                  onClick={() => pickGame(g)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <GameThumb src={g.game.thumbnail} name={g.game.name} size="xs" />
                  <span className="text-sm text-[var(--text)]">{g.game.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <IconButton
            label="Cerrar"
            tone="onImage"
            className="absolute top-4 right-4 text-2xl leading-none"
            onClick={() => setLightbox(null)}
          >
            ×
          </IconButton>
          {lightboxReport && (
            <MoreMenu
              tone="dark"
              className="absolute top-4 left-4 z-10"
              align="left"
              items={[
                {
                  label: lightboxReport.type === "review" ? "🚩 Denunciar opinión" : "🚩 Denunciar foto",
                  onClick: () => setReporting(lightboxReport),
                },
              ]}
            />
          )}
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

      {reporting && (
        <ReportModal targetType={reporting.type} targetId={reporting.id} onClose={() => setReporting(null)} />
      )}
    </div>
  );
}
