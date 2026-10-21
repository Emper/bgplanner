// La tarjeta de siempre (superficie, borde, esquinas 2xl y sombra suave) y
// los titulitos de sección. Antes había más de ochenta combinaciones de
// clases para la misma tarjeta.

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function cardClass({
  padding = "md",
  shadow = true,
  interactive = false,
  tone = "default",
  className = "",
}: {
  padding?: keyof typeof PADDING;
  shadow?: boolean;
  /** Para tarjetas que son enlaces: se ilumina el borde al pasar. */
  interactive?: boolean;
  /** `danger` para la zona de peligro (borrar, salir). */
  tone?: "default" | "danger";
  className?: string;
} = {}): string {
  return [
    `bg-[var(--surface)] rounded-2xl border ${tone === "danger" ? "border-[var(--danger)]/30" : "border-[var(--border)]"}`,
    shadow ? "shadow-[var(--card-shadow)]" : "",
    interactive ? "hover:border-[var(--primary)]/40 hover:shadow-[var(--card-shadow-hover)] transition-all duration-200" : "",
    PADDING[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function Card({
  as: Tag = "div",
  padding,
  shadow,
  interactive,
  tone,
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "article" | "li";
  padding?: keyof typeof PADDING;
  shadow?: boolean;
  interactive?: boolean;
  tone?: "default" | "danger";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cardClass({ padding, shadow, interactive, tone, className })} {...rest}>
      {children}
    </Tag>
  );
}

/** El titulito en mayúsculas pequeñas que encabeza un bloque. */
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3 ${className}`}>
      {children}
    </h2>
  );
}

/** Tarjeta con título, subtítulo y una acción a la derecha. */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cardClass({ className })}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
