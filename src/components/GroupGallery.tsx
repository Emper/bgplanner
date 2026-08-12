"use client";

import { useCallback, useEffect, useState } from "react";
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
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function GroupGallery({ groupId, currentUserId, isAdmin, reloadKey }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar esta crónica y sus fotos?")) return;
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

  if (loading) {
    return (
      <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
        Cargando galería…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-center py-12 text-sm" style={{ color: "#ef4444" }}>
        {error}
      </p>
    );
  }
  if (reviews.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📷</p>
        <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
          Aún no hay crónicas
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Marca un juego como jugado y cuéntanos qué tal: nota, comentario y fotos.
        </p>
      </div>
    );
  }

  return (
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
