"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "./Button";

// El modal de la app. Lo que antes cada modal hacía (o no) por su cuenta:
// - se cierra con Escape y pulsando fuera, salvo mientras `busy`;
// - bloquea el scroll de la página de debajo;
// - lleva el foco dentro al abrirse y lo devuelve al botón que lo abrió;
// - se anuncia como diálogo (role, aria-modal, aria-labelledby).
// Va en un portal a <body> a z-[70]: por encima de la navbar, los visores de
// fotos (z-[60]) y lo que sea, y por debajo de los avisos (z-[80]).

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

// Cuántos modales hay abiertos: el scroll se devuelve al cerrar el último.
let openCount = 0;

function lockScroll() {
  openCount++;
  if (openCount === 1) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = "";
}

const noopSubscribe = () => () => {};

/** true en el navegador, false en el servidor (para el portal). */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Una línea bajo el título. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Botones de abajo, alineados a la derecha. */
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  /** `danger` para lo que no tiene vuelta atrás (borde y título en rojo). */
  tone?: "default" | "danger";
  /** Mientras se guarda: ni Escape ni el fondo lo cierran. */
  busy?: boolean;
  showClose?: boolean;
  closeOnBackdrop?: boolean;
  /** Qué enfocar al abrir; por defecto, el primer campo o botón. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Nombre del diálogo cuando no hay `title` (cabeceras propias). */
  ariaLabel?: string;
  className?: string;
}

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone = "default",
  busy = false,
  showClose = true,
  closeOnBackdrop = true,
  initialFocusRef,
  ariaLabel,
  className = "",
}: ModalProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Lo último de onClose/busy sin volver a montar los efectos en cada render.
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    lockScroll();

    // Foco dentro: lo pedido, el primer campo (para escribir ya) o el panel.
    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])") ??
      panel;
    target?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Si hay otro modal encima, que se cierre solo ese.
        if (panel && !panel.contains(document.activeElement) && document.activeElement !== document.body) return;
        e.stopPropagation();
        if (!latest.current.busy) latest.current.onClose();
        return;
      }
      // Tab da la vuelta dentro del modal en vez de escaparse a la página.
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      previous?.focus?.({ preventScroll: true });
    };
    // initialFocusRef es un ref: no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !isClient) return null;

  const danger = tone === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-[fade-in_0.15s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop && !busy) onClose();
      }}
      // El portal saca el modal del DOM de la tarjeta que lo abre, pero en
      // React los eventos siguen subiendo por el árbol: que un clic aquí no
      // dispare el onClick de la tarjeta (o el enlace) de debajo.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`w-full ${SIZES[size]} max-h-[90vh] overflow-y-auto bg-[var(--surface)] rounded-2xl border ${
          danger ? "border-[var(--danger)]/40" : "border-[var(--border)]"
        } shadow-xl p-5 sm:p-6 outline-none ${className}`}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className={`text-lg font-bold leading-snug ${danger ? "text-[var(--danger)]" : "text-[var(--text)]"}`}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-[var(--text-secondary)] mt-1">
                  {description}
                </p>
              )}
            </div>
            {showClose && <CloseButton onClick={onClose} disabled={busy} className="-mr-1 -mt-1" />}
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
