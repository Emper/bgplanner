"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Los avisos flotantes de abajo («Guardado», «No se ha podido…»). Uno a la
// vez: el nuevo sustituye al anterior y se queda su tiempo entero (antes el
// temporizador del primero cortaba al segundo). Se anuncian a los lectores
// de pantalla y pueden llevar un «Deshacer».
//
//   const toast = useToast();
//   toast("Guardado");
//   toast.error("No se ha podido guardar");
//   toast.success("¡Lo jugamos! 🎲");
//   toast("Quitado de tu wishlist", { action: { label: "Deshacer", onClick: undo } });

export type ToastTone = "neutral" | "success" | "error";

export interface ToastOptions {
  tone?: ToastTone;
  /** Milisegundos a la vista. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  message: React.ReactNode;
}

type ToastFn = ((message: React.ReactNode, opts?: ToastOptions) => void) & {
  success: (message: React.ReactNode, opts?: Omit<ToastOptions, "tone">) => void;
  error: (message: React.ReactNode, opts?: Omit<ToastOptions, "tone">) => void;
};

const ToastContext = createContext<ToastFn | null>(null);

const TONES: Record<ToastTone, string> = {
  neutral: "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]",
  success: "bg-[var(--primary)] text-[var(--primary-text)] font-semibold",
  error: "bg-[var(--surface)] text-[var(--danger)] border border-[var(--danger)]/40",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  // Cada aviso nuevo es otro objeto: el efecto cancela el temporizador del
  // anterior y arranca el suyo, así nadie corta a nadie.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration ?? (toast.action ? 6000 : 4000));
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((message: React.ReactNode, opts: ToastOptions = {}) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, ...opts }));
  }, []);

  const api = useMemo(
    (): ToastFn =>
      Object.assign((message: React.ReactNode, opts?: ToastOptions) => show(message, opts), {
        success: (message: React.ReactNode, opts?: Omit<ToastOptions, "tone">) =>
          show(message, { ...opts, tone: "success" }),
        error: (message: React.ReactNode, opts?: Omit<ToastOptions, "tone">) =>
          show(message, { ...opts, tone: "error" }),
      }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* La región existe siempre para que los lectores de pantalla la oigan */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-max max-w-[90vw] pointer-events-none"
      >
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm text-center fx-toast-in ${TONES[toast.tone ?? "neutral"]}`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast necesita <ToastProvider> (está en el layout raíz)");
  return ctx;
}
