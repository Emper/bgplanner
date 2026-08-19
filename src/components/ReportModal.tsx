"use client";

import { useState } from "react";

export type ReportTargetType = "photo" | "review" | "comment" | "user";

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  /** Qué se está denunciando, en corto: "la foto de Ana", "el comentario de Luis". */
  targetLabel?: string;
  onClose: () => void;
  /** Se llama tras enviar la denuncia correctamente. */
  onDone?: (message: string) => void;
}

const REASONS: { value: string; label: string }[] = [
  { value: "offensive", label: "Contenido ofensivo o violento" },
  { value: "sexual", label: "Contenido sexual o inapropiado" },
  { value: "harassment", label: "Acoso hacia una persona" },
  { value: "spam", label: "Spam o publicidad" },
  { value: "other", label: "Otro motivo" },
];

const TITLES: Record<ReportTargetType, string> = {
  photo: "Denunciar esta foto",
  review: "Denunciar esta opinión",
  comment: "Denunciar este comentario",
  user: "Denunciar a esta persona",
};

export default function ReportModal({
  targetType,
  targetId,
  targetLabel,
  onClose,
  onDone,
}: Props) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!reason) {
      setError("Elige un motivo");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo enviar la denuncia");
        setSending(false);
        return;
      }
      onDone?.("🚩 Denuncia enviada. La revisaremos lo antes posible.");
      onClose();
    } catch {
      setError("No se pudo enviar la denuncia");
      setSending(false);
    }
  };

  return (
    <div
      data-no-swipe
      className="modal-sheet fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
        style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
        >
          {TITLES[targetType]}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          {targetLabel
            ? `Vas a denunciar ${targetLabel}. `
            : ""}
          Lo revisará el equipo de BG Planner. La persona denunciada no sabrá
          que has sido tú.
        </p>

        <fieldset className="mb-4">
          <legend className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            Motivo
          </legend>
          <div className="space-y-1">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-sm"
                style={{
                  border: `1px solid ${reason === r.value ? "var(--primary)" : "var(--border)"}`,
                  background: reason === r.value ? "var(--accent-soft)" : "transparent",
                  color: "var(--text)",
                }}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => {
                    setReason(r.value);
                    setError("");
                  }}
                  className="accent-[var(--primary)]"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
          Cuéntanos algo más (opcional)
        </label>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Qué ha pasado, por qué te parece inapropiado…"
          className="w-full rounded-xl p-3 mb-1 text-sm resize-none"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        />
        <div className="text-right text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {detail.length}/1000
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
            disabled={sending}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !reason}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "#ef4444", color: "#ffffff" }}
          >
            {sending ? "Enviando…" : "Enviar denuncia"}
          </button>
        </div>
      </div>
    </div>
  );
}
