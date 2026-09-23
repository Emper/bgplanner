import Link from "next/link";

// El gancho para quien aterriza en algo público (un perfil, una colección
// compartida, un evento abierto) sin cuenta. Va arriba del todo porque es lo
// primero que hay que ver: esa persona ya ha llegado hasta aquí por un
// amigo, y es el mejor momento para que se quede. La frase cambia según lo
// que está mirando, para que suene a "esto también puede ser tuyo" y no a
// un anuncio genérico.

type Variant = "profile" | "collection" | "event";

const COPY: Record<
  Variant,
  { emoji: string; title: string; text: (name?: string) => string }
> = {
  profile: {
    emoji: "🏆",
    title: "¿Cuántas insignias sacarías tú?",
    text: (name) =>
      `Monta tu perfil${name ? ` como el de ${name}` : ""}: tu colección de BGG, tus grupos y tus logros, y que tu grupo vote a qué se juega.`,
  },
  collection: {
    emoji: "🎲",
    title: "¿Tu estantería también da para presumir?",
    text: (name) =>
      `Trae tu colección de BGG a BG Planner y compártela${name ? ` como ${name}` : ""}. Luego, que tu grupo vote a qué se juega.`,
  },
  event: {
    emoji: "🎉",
    title: "Se acabó el eterno «¿a qué jugamos?»",
    text: () =>
      "En BG Planner tu grupo vota sus juegos, sale un ranking y las quedadas se organizan solas.",
  },
};

export default function SignupBanner({
  variant,
  name,
  redirect,
}: {
  variant: Variant;
  /** De quién es lo que está mirando, para personalizar la frase. */
  name?: string;
  /** Adónde volver tras registrarse: a lo que estaba viendo. */
  redirect?: string;
}) {
  const copy = COPY[variant];
  const href = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : "/login";

  return (
    <div className="mb-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--accent-soft)] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-2xl leading-none shrink-0" aria-hidden>
          {copy.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text)]">{copy.title}</p>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            {copy.text(name)}
          </p>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1">
        <Link
          href={href}
          className="inline-flex justify-center px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Crear cuenta gratis
        </Link>
        <span className="text-[11px] text-[var(--text-muted)] text-center sm:text-right">
          Solo tu email, sin contraseñas
        </span>
      </div>
    </div>
  );
}
