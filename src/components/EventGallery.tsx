"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Avatar from "./Avatar";
import EmojiField from "./EmojiField";
import { MoreMenu, ReportModal } from "./Moderation";
import { resizeImageToBlob } from "@/lib/image";
import { displayName } from "@/lib/users";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Button, { buttonClass, IconButton } from "./ui/Button";
import { fieldClass } from "./ui/Field";
import { useConfirm } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";
import { EmptyState } from "./ui/EmptyState";
import Spinner, { InlineLoading } from "./ui/Spinner";
import { cardClass } from "./ui/Card";

interface EventPhoto {
  id: string;
  url: string;
  userId: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
}
interface EventReview {
  id: string;
  rating: number | null;
  text: string | null;
  updatedAt: string;
  userId: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
}

interface Props {
  eventId: string;
  currentUserId: string;
  canParticipate: boolean;
  isAdmin: boolean;
  // Incrementar para hacer scroll al formulario de valoración (deep-link ?review=1).
  openReviewSignal: number;
}

const MAX_PER_UPLOAD = 10;

export default function EventGallery({
  eventId,
  currentUserId,
  canParticipate,
  isAdmin,
  openReviewSignal,
}: Props) {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [reviews, setReviews] = useState<EventReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reportingPhoto, setReportingPhoto] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();
  const toast = useToast();

  // El visor se cierra con Escape (si no hay una denuncia abierta encima).
  useEscapeKey(() => setLightbox(null), lightbox != null && !reportingPhoto);

  // Al recargar (tras guardar la valoración, p. ej.) no se vuelve a «Cargando…»:
  // se refresca en el sitio.
  const load = useCallback(
    () =>
      Promise.all([
        fetch(`/api/events/${eventId}/photos`).then((res) => (res.ok ? res.json() : null)),
        fetch(`/api/events/${eventId}/reviews`).then((res) => (res.ok ? res.json() : null)),
      ])
        .then(([pd, rd]) => {
          setError("");
          if (pd) setPhotos(pd.photos);
          if (rd) {
            setReviews(rd.reviews);
            const mine = (rd.reviews as EventReview[]).find((r) => r.userId === currentUserId);
            setRating(mine?.rating ?? 0);
            setReviewText(mine?.text ?? "");
          }
        })
        .catch(() => setError("Error al cargar la galería"))
        .finally(() => setLoading(false)),
    [eventId, currentUserId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openReviewSignal > 0) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [openReviewSignal]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files).slice(0, MAX_PER_UPLOAD)) {
        const blob = await resizeImageToBlob(f, 1600, 0.82);
        fd.append("file", blob, "foto.jpg");
      }
      const res = await fetch(`/api/events/${eventId}/photos`, { method: "POST", body: fd });
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
      const res = await fetch(`/api/events/${eventId}/photos/${id}`, { method: "DELETE" });
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

  const saveReview = async () => {
    setSavingReview(true);
    try {
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: rating > 0 ? rating : null, text: reviewText.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al guardar");
      } else {
        toast("¡Guardado!");
        load();
      }
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return <InlineLoading text="Cargando galería…" className="py-12" />;
  }

  const rated = reviews.filter((r) => r.rating && r.rating > 0);
  const avg = rated.length
    ? rated.reduce((a, r) => a + (r.rating || 0), 0) / rated.length
    : null;

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {/* ── Valoraciones ── */}
      <section ref={reviewRef}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Valoraciones</h3>
          {avg != null && (
            <span className="text-sm text-[var(--primary)]">
              ★ {avg.toFixed(1)} <span className="text-[var(--text-muted)]">({rated.length})</span>
            </span>
          )}
        </div>

        {canParticipate && (
          <div className={cardClass({ padding: "none", className: "p-4 mb-4" })}>
            <p className="text-sm mb-2 text-[var(--text-secondary)]">Tu valoración</p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n === rating ? 0 : n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className={`text-3xl leading-none transition-transform hover:scale-110 ${
                    (hover || rating) >= n ? "text-[var(--primary)]" : "text-[var(--border)]"
                  }`}
                  aria-label={`${n} estrellas`}
                >
                  ★
                </button>
              ))}
            </div>
            <EmojiField
              value={reviewText}
              onChange={setReviewText}
              maxLength={1000}
              rows={3}
              placeholder="¿Qué tal el evento? Lo mejor, lo que repetirías…"
              className={fieldClass({ className: "resize-none" })}
            />
            <div className="flex items-center justify-end gap-3 mt-2">
              <Button onClick={saveReview} loading={savingReview}>
                {savingReview ? "Guardando…" : "Guardar valoración"}
              </Button>
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aún no hay valoraciones.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const authorName = displayName(r.user, "Alguien");
              return (
                <div key={r.id} className="flex items-start gap-3">
                  <Avatar name={authorName} avatarUrl={r.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{authorName}</p>
                    {r.rating != null && r.rating > 0 && (
                      <p className="text-sm text-[var(--primary)]">
                        {"★".repeat(r.rating)}
                        <span className="text-[var(--border)]">{"★".repeat(5 - r.rating)}</span>
                      </p>
                    )}
                    {r.text && <p className="text-sm whitespace-pre-wrap text-[var(--text)]">{r.text}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Fotos ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Fotos</h3>
          {canParticipate && (
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
                "＋ Subir fotos"
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {photos.length === 0 ? (
          <EmptyState
            icon="📷"
            title="Aún no hay fotos."
            description={canParticipate ? "¡Sé el primero en subir alguna!" : undefined}
          />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, i) => {
              const canDelete = p.userId === currentUserId || isAdmin;
              return (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden group">
                  <button onClick={() => setLightbox(i)} className="absolute inset-0">
                    <Image
                      src={p.url}
                      alt="Foto del evento"
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
        )}
      </section>

      {lightbox != null && photos[lightbox] && (
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
          {photos[lightbox].userId !== currentUserId && (
            <MoreMenu
              tone="dark"
              className="absolute top-4 left-4 z-10"
              align="left"
              items={[{ label: "🚩 Denunciar foto", onClick: () => setReportingPhoto(photos[lightbox].id) }]}
            />
          )}
          {photos.length > 1 && (
            <button
              className="absolute left-4 text-white text-4xl leading-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
              }}
              aria-label="Anterior"
            >
              ‹
            </button>
          )}
          <div className="relative w-full max-w-3xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[lightbox].url}
              alt="Foto del evento"
              fill
              unoptimized
              className="object-contain"
              sizes="100vw"
            />
          </div>
          {photos.length > 1 && (
            <button
              className="absolute right-4 text-white text-4xl leading-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i == null ? i : (i + 1) % photos.length));
              }}
              aria-label="Siguiente"
            >
              ›
            </button>
          )}
        </div>
      )}

      {reportingPhoto && (
        <ReportModal targetType="event_photo" targetId={reportingPhoto} onClose={() => setReportingPhoto(null)} />
      )}
    </div>
  );
}
