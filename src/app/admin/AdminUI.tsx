import { BackLink } from "@/components/ui/PageHeader";

// Piezas propias del panel de admin. El admin lleva su acento morado (la
// marca «BG Admin» y las fichas activas) y su titular en Bricolage, para que
// no se confunda nunca con la app normal. El resto sale del kit.

/** El titular de una página del admin. */
export function AdminTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`text-2xl font-display font-semibold break-words ${className}`}>{children}</h1>;
}

/** Cabecera de una página del admin: volver, titular, entradilla y acciones. */
export function AdminHeader({
  title,
  badge,
  lead,
  back,
  action,
}: {
  title: React.ReactNode;
  /** Una etiqueta junto al titular (Privado…). */
  badge?: React.ReactNode;
  lead?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
  action?: React.ReactNode;
}) {
  return (
    <header>
      {back && (
        <BackLink href={back.href} className="mb-3">
          {back.label}
        </BackLink>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {badge ? (
            <div className="flex flex-wrap items-center gap-2">
              <AdminTitle>{title}</AdminTitle>
              {badge}
            </div>
          ) : (
            <AdminTitle>{title}</AdminTitle>
          )}
          {lead && <div className="text-sm text-[var(--text-secondary)] mt-1">{lead}</div>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}

/** Ficha de filtro del admin, morada cuando está activa. */
export function AdminChip({
  active = false,
  count,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 ${
        active
          ? "bg-purple-600 text-white border-purple-600"
          : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
      } ${className}`}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <span className={`ml-1.5 text-xs tabular-nums ${active ? "text-white/80" : "text-[var(--text-muted)]"}`}>{count}</span>
      )}
    </button>
  );
}
