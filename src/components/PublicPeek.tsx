import Image from "next/image";
import SmartNav from "@/components/SmartNav";
import PageShell from "@/components/ui/PageShell";
import { ButtonLink } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Notice } from "@/components/ui/EmptyState";

/**
 * Lo que ve quien llega con un enlace de un grupo o un evento y no tiene la
 * sesión iniciada: una ficha con lo imprescindible y un botón para entrar.
 * Nada de miembros, asistentes, juegos ni actividad.
 */
export default function PublicPeek({
  eyebrow,
  title,
  lead,
  imageUrl,
  emoji,
  facts,
  note,
  cta,
  banner,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Una frase bajo el título (la descripción corta de un evento). */
  lead?: string | null;
  imageUrl?: string | null;
  emoji?: string;
  /** Las dos o tres líneas de datos, ya formateadas. */
  facts?: string[];
  /** Aclaración bajo los datos (p. ej. que el evento es privado). */
  note?: string;
  cta: { href: string; label: string; hint?: string };
  /** Algo que va encima de la ficha: el gancho para registrarse. */
  banner?: React.ReactNode;
  /** Lo que va debajo de la ficha (la info general de un evento). */
  children?: React.ReactNode;
}) {
  const ctaButton = (
    <ButtonLink href={cta.href} size="lg">
      {cta.label}
    </ButtonLink>
  );

  // Sin datos que enseñar (un evento privado): un aviso de página entera.
  if (!imageUrl && !lead && !(facts && facts.length > 0)) {
    return (
      <PageShell nav={<SmartNav />} width="form">
        {banner}
        <Notice
          icon={emoji}
          title={title}
          actions={ctaButton}
        >
          {eyebrow ? <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{eyebrow}</p> : null}
          {note ? <p className="leading-relaxed">{note}</p> : null}
          {cta.hint ? <p className="text-xs text-[var(--text-muted)]">{cta.hint}</p> : null}
        </Notice>
        {children ? <div className="mt-5">{children}</div> : null}
      </PageShell>
    );
  }

  return (
    <PageShell nav={<SmartNav />} width="form">
      {banner}
      <div className={cardClass({ padding: "none", className: "overflow-hidden" })}>
        {imageUrl ? (
          <div className="h-40 sm:h-52 overflow-hidden">
            <Image
              src={imageUrl}
              alt={title}
              width={800}
              height={300}
              unoptimized
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        <div className="p-7 text-center">
          {!imageUrl && emoji ? (
            <div className="text-5xl mb-3" aria-hidden>
              {emoji}
            </div>
          ) : null}
          {eyebrow ? (
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{eyebrow}</p>
          ) : null}
          <h1 className="page-title break-words">{title}</h1>
          {lead ? <p className="page-lead mt-2 break-words">{lead}</p> : null}

          {facts && facts.length > 0 ? (
            <div className="mt-3 space-y-1">
              {facts.map((fact) => (
                <p key={fact} className="text-sm text-[var(--text-secondary)]">
                  {fact}
                </p>
              ))}
            </div>
          ) : null}

          {note ? <p className="mt-4 text-sm text-[var(--text-muted)] leading-relaxed">{note}</p> : null}

          <div className="mt-6">{ctaButton}</div>
          {cta.hint ? <p className="mt-3 text-xs text-[var(--text-muted)]">{cta.hint}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </PageShell>
  );
}
