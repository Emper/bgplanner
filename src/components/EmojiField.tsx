"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EMOJI_CATEGORIES, parseEntry, searchEmojis } from "@/lib/emoji";

/**
 * Campo de texto (textarea o input) con botón de emojis, al estilo WhatsApp.
 *
 * Detalles que importan:
 * - El emoji se inserta en la posición del cursor, no al final.
 * - El panel se pinta en un portal con posición fija: así no lo recorta el
 *   `overflow` de los modales ni las tarjetas del ranking.
 * - Mientras el panel está abierto se "traga" el onBlur del campo. Hay sitios
 *   (el comentario del ranking) que guardan y cierran el editor al perder el
 *   foco; sin esto, abrir el selector cerraría el editor antes de elegir nada.
 */

const RECENTS_KEY = "bgp:recent-emojis";
const MAX_RECENTS = 24;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // localStorage puede fallar (modo privado); los recientes son opcionales.
  }
}

const PANEL_WIDTH = 328;
const PANEL_HEIGHT = 324;
const COLS = 7;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function EmojiGrid({
  emojis,
  titles,
  onPick,
}: {
  emojis: string[];
  titles?: string[];
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
      {emojis.map((emoji, i) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          title={titles?.[i]}
          aria-label={`Insertar ${emoji}`}
          className="h-10 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] active:scale-95 transition-all"
        >
          <span className="text-[22px] leading-none">{emoji}</span>
        </button>
      ))}
    </div>
  );
}

type PanelProps = {
  anchor: HTMLElement;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

function EmojiPanel({ anchor, onPick, onClose }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  // El panel solo se monta al pulsar el botón, así que localStorage ya existe.
  const [recents, setRecents] = useState<string[]>(readRecents);

  // Posicionamiento imperativo: el panel vive en un portal con `position:
  // fixed`, así que se coloca tocando el DOM en vez de con estado de React.
  const place = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = anchor.getBoundingClientRect();
    const width = el.offsetWidth || PANEL_WIDTH;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    // Abrimos hacia abajo salvo que no quepa: así el panel queda pegado al
    // campo y no tapa media pantalla por encima.
    const openUp = spaceBelow < PANEL_HEIGHT + 8 && spaceAbove > spaceBelow;
    const top = openUp
      ? rect.top - PANEL_HEIGHT - 8
      : Math.min(rect.bottom + 8, window.innerHeight - PANEL_HEIGHT - 8);
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8
    );
    el.style.top = `${Math.max(8, top)}px`;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.visibility = "visible";
  }, [anchor]);

  useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  // Cerrar al pulsar fuera o con Escape.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  const handlePick = (emoji: string) => {
    const next = [emoji, ...recents.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(next);
    onPick(emoji);
  };

  const results = query.trim() ? searchEmojis(query) : null;
  const current = EMOJI_CATEGORIES.find((c) => c.id === category) ?? EMOJI_CATEGORIES[0];
  const visible = results ?? current.entries.map(parseEntry);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Selector de emojis"
      // Evita que el campo pierda el foco al interactuar con el panel.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[100] rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl shadow-black/30 overflow-hidden flex flex-col"
      style={{
        top: 0,
        left: 0,
        width: PANEL_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        height: PANEL_HEIGHT,
        // `place()` lo coloca antes de pintar; así no se ve saltar.
        visibility: "hidden",
      }}
    >
      <div className="p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar emoji…"
          className="w-full px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none transition-colors"
          // El input del panel sí necesita poder recibir el foco.
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto px-1.5 pb-4">
          {!results && recents.length > 0 && (
            <>
              <SectionLabel>Recientes</SectionLabel>
              <EmojiGrid emojis={recents} onPick={handlePick} />
            </>
          )}

          {!results && <SectionLabel>{current.label}</SectionLabel>}

          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--text-muted)]">
              Ningún emoji para “{query.trim()}”.
            </p>
          ) : (
            <EmojiGrid
              emojis={visible.map((e) => e.char)}
              titles={visible.map((e) => e.keywords.split(" ")[0])}
              onPick={handlePick}
            />
          )}
        </div>
        {/* Fundido inferior: sin él la fila que queda a medias parece rota
            en vez de "sigue habiendo más abajo". */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[var(--surface)] to-transparent" />
      </div>

      {!results && (
        <div className="flex items-center gap-0.5 px-1.5 py-1.5 border-t border-[var(--border)] bg-[var(--input-bg)]/40">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              aria-label={cat.label}
              aria-pressed={cat.id === category}
              title={cat.label}
              className={`flex-1 h-8 rounded-lg transition-all ${
                cat.id === category
                  ? "bg-[var(--primary)]/15 opacity-100"
                  : "opacity-45 hover:opacity-100 hover:bg-[var(--surface-hover)]"
              }`}
            >
              <span className="text-[17px] leading-none">{cat.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// Carita monocroma en currentColor. Un emoji de verdad se pintaría siempre
// amarillo y desentonaría con el resto de iconos de la app.
function SmileyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

type FieldElement = HTMLTextAreaElement | HTMLInputElement;

type EmojiFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Por defecto textarea; `false` para un input de una línea. */
  multiline?: boolean;
  className?: string;
  wrapperClassName?: string;
  style?: React.CSSProperties;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  name?: string;
  onBlur?: (e: React.FocusEvent<FieldElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<FieldElement>) => void;
};

export default function EmojiField({
  value,
  onChange,
  multiline = true,
  className = "",
  wrapperClassName = "",
  style,
  rows,
  maxLength,
  placeholder,
  disabled,
  required,
  autoFocus,
  name,
  onBlur,
  onKeyDown,
}: EmojiFieldProps) {
  // En un campo de varias filas el botón va abajo a la derecha; en uno de una
  // sola línea, centrado verticalmente.
  const tallField = multiline && (rows ?? 1) > 1;

  const fieldRef = useRef<FieldElement>(null);
  // El botón se guarda en estado (no en una ref) porque el panel lo necesita
  // como ancla durante el render.
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  // Ref espejo del estado: el onBlur se dispara antes de que React repinte.
  const openRef = useRef(false);

  const closePanel = useCallback((refocus: boolean) => {
    openRef.current = false;
    setAnchorEl(null);
    if (refocus) fieldRef.current?.focus();
  }, []);

  const insertEmoji = (emoji: string) => {
    const el = fieldRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    if (maxLength != null && next.length > maxLength) return;
    onChange(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      const node = fieldRef.current;
      if (!node) return;
      node.focus();
      try {
        node.setSelectionRange(caret, caret);
      } catch {
        // Algunos tipos de input no soportan selección; no es crítico.
      }
    });
  };

  const handleBlur = (e: React.FocusEvent<FieldElement>) => {
    // Con el panel abierto el foco se va al selector, no "fuera" del campo.
    if (openRef.current) return;
    onBlur?.(e);
  };

  const sharedProps = {
    value,
    onChange: (e: React.ChangeEvent<FieldElement>) => onChange(e.target.value),
    onBlur: handleBlur,
    onKeyDown,
    maxLength,
    placeholder,
    disabled,
    required,
    autoFocus,
    name,
    style,
    className: `${className} pr-11`,
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      {multiline ? (
        <textarea
          {...sharedProps}
          ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
        />
      ) : (
        <input
          {...sharedProps}
          ref={fieldRef as React.RefObject<HTMLInputElement>}
          type="text"
        />
      )}

      <button
        type="button"
        disabled={disabled}
        aria-label="Insertar emoji"
        aria-expanded={anchorEl != null}
        title="Insertar emoji"
        // Sin esto, pulsar el botón le quita el foco (y el cursor) al campo.
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          if (openRef.current) {
            closePanel(true);
          } else {
            openRef.current = true;
            setAnchorEl(e.currentTarget);
          }
        }}
        className={`absolute right-2 w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
          anchorEl
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--border)]/50"
        } ${tallField ? "bottom-2" : "top-1/2 -translate-y-1/2"}`}
      >
        <SmileyIcon />
      </button>

      {anchorEl && (
        <EmojiPanel
          anchor={anchorEl}
          onPick={insertEmoji}
          onClose={() => closePanel(false)}
        />
      )}
    </div>
  );
}
