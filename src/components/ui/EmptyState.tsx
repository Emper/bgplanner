// Huecos vacíos y pantallas de aviso.
//
// - EmptyState: dentro de una lista o pestaña («Aún no hay fotos»).
// - Notice: la página entera es el aviso (no existe, enlace caducado, falta
//   conectar BGG). Va dentro de `page-pad` + `page-form`; el título es el h1.

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "plain",
  className = "",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `card` la mete en una tarjeta; `dashed`, con borde discontinuo. */
  variant?: "plain" | "card" | "dashed";
  className?: string;
}) {
  const box =
    variant === "card"
      ? "bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-6 py-10"
      : variant === "dashed"
        ? "rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-10"
        : "py-12";
  return (
    <div className={`text-center ${box} ${className}`}>
      {icon && <div className="text-4xl mb-3" aria-hidden>{icon}</div>}
      <p className="font-semibold text-[var(--text)]">{title}</p>
      {description && <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Notice({
  icon,
  title,
  children,
  actions,
  className = "",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6 sm:p-8 text-center ${className}`}
    >
      {icon && <div className="text-5xl mb-4" aria-hidden>{icon}</div>}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
      {children && <div className="text-sm text-[var(--text-secondary)] mt-2 space-y-2">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
