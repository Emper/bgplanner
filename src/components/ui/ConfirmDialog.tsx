"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Input } from "./Field";

// Confirmaciones con la cara de la app en vez del confirm() del navegador.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "¿Quitar el juego?", confirmLabel: "Quitar", tone: "danger" }))) return;
//
// Para lo muy gordo (borrar un grupo, la cuenta) `requireText` obliga a
// escribir algo (el nombre del grupo) antes de dejar confirmar.

export interface ConfirmOptions {
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Texto que hay que escribir tal cual para poder confirmar. */
  requireText?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // Si ya había una abierta (doble clic), la anterior cuenta como "no".
        pendingRef.current?.resolve(false);
        const next = { ...opts, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    []
  );

  const close = (ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          open
          {...pending}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/** Devuelve `confirm(opts)`, que resuelve a true si el usuario acepta. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm necesita <ConfirmProvider> (está en el layout raíz)");
  return ctx;
}

/**
 * La confirmación como componente, para cuando hace falta controlarla a mano
 * (p. ej. dejarla abierta con `busy` mientras se borra).
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  requireText,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const blocked = !!requireText && typed.trim() !== requireText.trim();

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      tone={tone}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={blocked}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body && <div className="text-sm text-[var(--text-secondary)] space-y-2">{body}</div>}
      {requireText && (
        <div className="mt-4">
          <p className="text-xs text-[var(--text-secondary)] mb-1.5">
            Escribe <strong className="text-[var(--text)]">{requireText}</strong> para confirmar
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            tone={tone === "danger" ? "danger" : "default"}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !blocked && !busy) onConfirm();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
