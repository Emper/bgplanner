// La ruedita de "cargando" dentro de botones, avisos y listas. Para cargar
// una página entera está PageLoader (el dado).

const SIZES = {
  xs: "w-3.5 h-3.5 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

const TONES = {
  primary: "border-[var(--primary)]",
  current: "border-current",
  muted: "border-[var(--text-muted)]",
};

export default function Spinner({
  size = "sm",
  tone = "primary",
  label,
  className = "",
}: {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  /** Texto para lectores de pantalla; sin él, es decorativo. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 rounded-full border-t-transparent animate-spin ${SIZES[size]} ${TONES[tone]} ${className}`}
    />
  );
}

/** «Cargando…» en línea, para huecos pequeños (una lista, un panel). */
export function InlineLoading({ text = "Cargando…", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)] ${className}`}>
      <Spinner size="sm" tone="muted" />
      {text}
    </div>
  );
}
