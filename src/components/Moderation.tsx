"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  REPORT_TEXT_MAX,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";
import { forgetFriend } from "@/lib/friends";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { FieldError, Textarea } from "./ui/Field";

// Piezas de moderación que se repiten por toda la app: el menú «⋯» discreto,
// el modal de denunciar y el de bloquear. Los modales son el `Modal` del kit,
// que va a z-[70]: por encima de los visores de fotos (z-[60]).

export interface MoreMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Visible pero sin efecto (p. ej. mientras se hace). */
  disabled?: boolean;
}

/**
 * Botón «⋯» con un menú desplegable. `tone="dark"` para fondos oscuros (visor
 * de fotos); `align="left"` si el botón queda a la izquierda y el menú, que
 * por defecto se abre hacia ese lado, se saldría de la pantalla.
 */
export function MoreMenu({
  items,
  label = "Más opciones",
  tone = "default",
  align = "right",
  className = "",
}: {
  items: MoreMenuItem[];
  label?: string;
  tone?: "default" | "dark";
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);
  useEscapeKey(() => setOpen(false), open);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          // Suele ir dentro de tarjetas con enlaces: que el clic no navegue
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className={
          tone === "dark"
            ? "w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            : "w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
        }
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full mt-1 z-40 min-w-[190px] py-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg text-left`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                item.onClick();
              }}
              className={`w-full px-3.5 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:pointer-events-none ${
                item.danger ? "text-[var(--danger)]" : "text-[var(--text)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Denunciar algo: motivo + texto opcional. Al terminar enseña el agradecimiento. */
export function ReportModal({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const formId = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, text: text.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      // Ya denunciado antes: para quien denuncia es lo mismo que haberlo hecho ahora
      if (!res.ok && res.status !== 409) throw new Error(data.error || "No se pudo enviar la denuncia");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la denuncia");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Modal open onClose={onClose} showClose={false}>
        <div className="text-center py-2">
          <p className="text-4xl mb-3" aria-hidden>🛡️</p>
          <h2 className="text-lg font-semibold mb-2 text-[var(--text)]">Gracias por avisar</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Lo revisaremos lo antes posible y, si incumple las normas, lo retiraremos.
            {targetType !== "user" && " Si no quieres saber nada más de esta persona, también puedes bloquearla."}
          </p>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={sending}
      title={`Denunciar ${REPORT_TARGET_LABELS[targetType].this}`}
      description="Nadie más sabrá que has sido tú. ¿Qué pasa?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            loading={sending}
            disabled={!reason || (reason === "other" && !text.trim())}
          >
            {sending ? "Enviando…" : "Denunciar"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <div className="space-y-2 mb-4" role="radiogroup" aria-label="Motivo">
          {REPORT_REASONS.map((r) => {
            const selected = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all duration-200 ${
                  selected
                    ? "border-[var(--primary)] bg-[var(--accent-soft)] text-[var(--text)] font-medium"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                <span aria-hidden>{r.emoji}</span>
                {r.label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={REPORT_TEXT_MAX}
          rows={3}
          placeholder={reason === "other" ? "Cuéntanos qué pasa" : "Algo más que debamos saber (opcional)"}
        />
        <FieldError className="mt-2">{error}</FieldError>
      </form>
    </Modal>
  );
}

export async function blockUser(userId: string): Promise<string | null> {
  const res = await fetch("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).catch(() => null);
  if (res?.ok) {
    forgetFriend(userId);
    return null;
  }
  const data = await res?.json().catch(() => ({}));
  return data?.error || "No se pudo bloquear";
}

export async function unblockUser(userId: string): Promise<boolean> {
  const res = await fetch(`/api/blocks/${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => null);
  return !!res?.ok;
}

/** Confirmación de bloqueo, contando qué cambia. */
export function BlockModal({
  user,
  onClose,
  onBlocked,
}: {
  user: { id: string; name: string };
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    const err = await blockUser(user.id);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onBlocked();
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={`¿Bloquear a ${user.name}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            {busy ? "Bloqueando…" : "Bloquear"}
          </Button>
        </>
      }
    >
      <ul className="text-sm text-[var(--text-secondary)] space-y-2 mb-5">
        <li className="flex gap-2">
          <span aria-hidden>🙈</span>
          <span>Dejarás de ver sus hilos y respuestas en la Comunidad.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🔕</span>
          <span>No te llegará ningún aviso suyo, tampoco al móvil.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🤝</span>
          <span>No podrá añadirte a sus amigos, y si lo erais, dejaréis de serlo.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🎲</span>
          <span>En los grupos y eventos que compartís todo sigue igual.</span>
        </li>
      </ul>
      <p className="text-xs text-[var(--text-muted)]">
        No se lo diremos, y puedes desbloquearle cuando quieras desde tu perfil.
      </p>
      <FieldError className="mt-3">{error}</FieldError>
    </Modal>
  );
}
