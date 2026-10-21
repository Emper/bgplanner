"use client";

import { useId, useState } from "react";
import Image from "next/image";
import EmojiField from "./EmojiField";
import { resizeImageToBlob } from "@/lib/image";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Spinner from "./ui/Spinner";
import { FieldError, fieldClass, LABEL_CLASS } from "./ui/Field";

interface Props {
  groupId: string;
  gameId: string;
  gameName: string;
  // "mark": el juego se marca como jugado al guardar (flujo desde el ranking).
  // "review": el juego ya está jugado, solo se añade la opinión.
  mode: "mark" | "review";
  onClose: () => void;
  onDone: () => void;
}

const MAX_PHOTOS = 8;

export default function GameReviewModal({
  groupId,
  gameId,
  gameName,
  mode,
  onClose,
  onDone,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const commentId = useId();

  const hasContent = rating > 0 || text.trim().length > 0 || photos.length > 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const room = MAX_PHOTOS - photos.length;
    const toProcess = Array.from(files).slice(0, room);
    if (toProcess.length === 0) {
      setError(`Máximo ${MAX_PHOTOS} fotos por opinión`);
      return;
    }
    setUploading((n) => n + toProcess.length);
    for (const file of toProcess) {
      try {
        const blob = await resizeImageToBlob(file, 1600, 0.82);
        const fd = new FormData();
        fd.append("file", blob, "foto.jpg");
        const res = await fetch(`/api/groups/${groupId}/photos`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al subir la foto");
        } else if (data.url) {
          setPhotos((prev) => [...prev, data.url]);
        }
      } catch {
        setError("Error al procesar la foto");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p !== url));
  };

  const markPlayed = async () => {
    const res = await fetch(`/api/groups/${groupId}/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ played: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error al marcar como jugado");
    }
  };

  const saveReview = async () => {
    const res = await fetch(`/api/groups/${groupId}/games/${gameId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: rating > 0 ? rating : null,
        text: text.trim() || undefined,
        photoUrls: photos,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error al guardar la opinión");
    }
  };

  const handleMarkOnly = async () => {
    setSaving(true);
    setError("");
    try {
      await markPlayed();
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (uploading > 0) return;
    if (!hasContent) {
      setError("Añade una nota, un comentario o al menos una foto");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (mode === "mark") await markPlayed();
      await saveReview();
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      size="lg"
      title="¿Qué tal la partida?"
      description={gameName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {mode === "mark" && (
            <Button variant="secondary" onClick={handleMarkOnly} disabled={saving || uploading > 0}>
              Solo marcar jugado
            </Button>
          )}
          <Button onClick={handleSave} disabled={uploading > 0 || !hasContent} loading={saving}>
            {saving ? "Guardando…" : "Guardar opinión"}
          </Button>
        </>
      }
    >
      {/* Nota */}
      <p className={LABEL_CLASS}>Tu valoración</p>
      <div className="flex gap-1 mb-4">
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

      {/* Comentario */}
      <label htmlFor={commentId} className={LABEL_CLASS}>
        Comentario
      </label>
      <EmojiField
        id={commentId}
        value={text}
        onChange={setText}
        maxLength={1000}
        rows={3}
        placeholder="¿Cómo fue? ¿Quién ganó? La anécdota de la partida…"
        wrapperClassName="mb-1"
        className={fieldClass({ className: "resize-none" })}
      />
      <div className="text-right text-xs mb-4 text-[var(--text-muted)]">{text.length}/1000</div>

      {/* Fotos */}
      <p className={LABEL_CLASS}>
        Fotos ({photos.length}/{MAX_PHOTOS})
      </p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {photos.map((url) => (
          <div key={url} className="relative aspect-square rounded-xl overflow-hidden">
            <Image src={url} alt="Foto de la partida" fill className="object-cover" sizes="120px" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm flex items-center justify-center"
              aria-label="Quitar foto"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length + uploading < MAX_PHOTOS && (
          <label className="aspect-square rounded-xl flex items-center justify-center cursor-pointer text-2xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/60 hover:text-[var(--primary)] transition-colors">
            +
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              aria-label="Añadir fotos"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`up-${i}`}
            className="aspect-square rounded-xl flex items-center justify-center bg-[var(--input-bg)]"
          >
            <Spinner size="sm" tone="muted" label="Subiendo foto" />
          </div>
        ))}
      </div>

      <FieldError>{error}</FieldError>
    </Modal>
  );
}
