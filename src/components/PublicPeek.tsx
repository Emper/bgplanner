import Image from "next/image";
import Link from "next/link";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";

/**
 * Lo que ve quien llega con un enlace de un grupo o un evento y no tiene la
 * sesión iniciada: una ficha con lo imprescindible y un botón para entrar.
 * Nada de miembros, asistentes, juegos ni actividad.
 */
export default function PublicPeek({
  eyebrow,
  title,
  imageUrl,
  emoji,
  facts,
  note,
  cta,
  banner,
}: {
  eyebrow?: string;
  title: string;
  imageUrl?: string | null;
  emoji?: string;
  /** Las dos o tres líneas de datos, ya formateadas. */
  facts?: string[];
  /** Aclaración bajo los datos (p. ej. que el evento es privado). */
  note?: string;
  cta: { href: string; label: string; hint?: string };
  /** Algo que va encima de la ficha: el gancho para registrarse. */
  banner?: React.ReactNode;
}) {
  return (
    <>
      <SmartNav />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        {banner ? <div className="max-w-xl mx-auto">{banner}</div> : null}
        <div className="max-w-xl mx-auto bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] overflow-hidden">
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
              <div className="text-5xl mb-3">{emoji}</div>
            ) : null}
            {eyebrow ? (
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold text-[var(--text)] break-words">
              {title}
            </h1>

            {facts && facts.length > 0 ? (
              <div className="mt-3 space-y-1">
                {facts.map((fact) => (
                  <p key={fact} className="text-sm text-[var(--text-secondary)]">
                    {fact}
                  </p>
                ))}
              </div>
            ) : null}

            {note ? (
              <p className="mt-4 text-sm text-[var(--text-muted)] leading-relaxed">
                {note}
              </p>
            ) : null}

            <Link
              href={cta.href}
              className="inline-flex mt-6 px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {cta.label}
            </Link>
            {cta.hint ? (
              <p className="mt-3 text-xs text-[var(--text-muted)]">{cta.hint}</p>
            ) : null}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
