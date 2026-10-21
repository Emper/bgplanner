import Link from "next/link";

// La cabecera de una página interna: enlace de volver (opcional), titular,
// entradilla y una acción a la derecha. Siempre con el mismo hueco debajo.

/** «‹ Grupos»: vuelve a la sección de la que cuelga esta página. */
export function BackLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      {children}
    </Link>
  );
}

export default function PageHeader({
  title,
  lead,
  back,
  action,
  eyebrow,
  className = "",
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
  action?: React.ReactNode;
  /** Una línea pequeña sobre el titular. */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 ${className}`}>
      {back && <BackLink href={back.href} className="mb-3">{back.label}</BackLink>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">{eyebrow}</p>}
          <h1 className="page-title break-words">{title}</h1>
          {lead && <p className="page-lead mt-1">{lead}</p>}
        </div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
