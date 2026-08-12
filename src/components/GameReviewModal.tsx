"use client";

import { useState } from "react";
import Image from "next/image";
import { resizeImageToBlob } from "@/lib/image";

interface Props {
  groupId: string;
  gameId: string;
  gameName: string;
  // "mark": el juego se marca como jugado al guardar (flujo desde el ranking).
  // "review": el juego ya está jugado, solo se añade la crónica.
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

  const hasContent = rating > 0 || text.trim().length > 0 || photos.length > 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const room = MAX_PHOTOS - photos.length;
    const toProcess = Array.from(files).slice(0, room);
    if (toProcess.length === 0) {
      setError(`Máximo ${MAX_PHOTOS} fotos por crónica`);
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
      throw new Error(data.error || "Error al guardar la crónica");
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
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
        >
          ¿Qué tal la partida?
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          {gameName}
        </p>

        {/* Nota */}
        <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
          Tu valoración
        </label>
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="text-3xl leading-none transition-transform hover:scale-110"
              style={{ color: (hover || rating) >= n ? "#f59e0b" : "var(--border)" }}
              aria-label={`${n} estrellas`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Comentario */}
        <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
          Comentario
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="¿Cómo fue? ¿Quién ganó? La anécdota de la partida…"
          className="w-full rounded-xl p-3 mb-1 text-sm resize-none"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        />
        <div className="text-right text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {text.length}/1000
        </div>

        {/* Fotos */}
        <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
          Fotos ({photos.length}/{MAX_PHOTOS})
        </label>
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
            <label
              className="aspect-square rounded-xl flex items-center justify-center cursor-pointer text-2xl"
              style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
            >
              +
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
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
              className="aspect-square rounded-xl flex items-center justify-center text-xs animate-pulse"
              style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}
            >
              …
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm mb-3" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancelar
          </button>
          {mode === "mark" && (
            <button
              type="button"
              onClick={handleMarkOnly}
              disabled={saving || uploading > 0}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Solo marcar jugado
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading > 0 || !hasContent}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "#f59e0b", color: "#0f172a" }}
          >
            {saving ? "Guardando…" : "Guardar crónica"}
          </button>
        </div>
      </div>
    </div>
  );
}
