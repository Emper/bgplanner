"use client";

// Pestañas, conmutadores y fichas de filtro, todos con el mismo estado
// activo (ámbar suave) y con sus roles para lectores de pantalla.

export interface TabItem<V extends string> {
  value: V;
  label: React.ReactNode;
  count?: number;
}

/** Pestañas subrayadas de una página (Ranking, Miembros, Galería…). */
export function Tabs<V extends string>({
  value,
  onChange,
  items,
  className = "",
}: {
  value: V;
  onChange: (value: V) => void;
  items: TabItem<V>[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto no-scrollbar border-b border-[var(--border)] ${className}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`shrink-0 px-3 sm:px-4 py-2 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 opacity-60 tabular-nums">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Conmutador de pocas opciones excluyentes (vista, tema, visibilidad). */
export function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
  className = "",
}: {
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
  /** Para lectores de pantalla: qué se está eligiendo. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex p-1 gap-1 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg font-medium whitespace-nowrap transition-colors ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${
              active
                ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Las clases de una ficha, para cuando es un <Link>. */
export function chipClass({ active = false, size = "md", className = "" }: { active?: boolean; size?: "sm" | "md"; className?: string } = {}) {
  return `inline-flex items-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors ${
    size === "sm" ? "px-2 py-1 text-[11px] sm:text-xs" : "px-3 py-1.5 text-xs sm:text-sm"
  } ${
    active
      ? "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]/40"
      : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
  }${className ? ` ${className}` : ""}`;
}

/** Ficha que se activa y desactiva (filtros, orden, etiquetas). */
export function Chip({
  active = false,
  size = "md",
  count,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: "sm" | "md";
  count?: number;
}) {
  return (
    <button type="button" aria-pressed={active} className={chipClass({ active, size, className })} {...rest}>
      {children}
      {count !== undefined && <span className="opacity-60 tabular-nums">{count}</span>}
    </button>
  );
}
