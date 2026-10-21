import Link from "next/link";
import { forwardRef } from "react";
import Spinner from "./Spinner";

// Los botones de la app. Un solo sitio para sus clases: antes había más de
// cincuenta combinaciones distintas para el mismo botón ámbar.
//
// - primary: la acción principal de la pantalla (ámbar).
// - secondary: la alternativa (Cancelar, Volver), con borde.
// - ghost: acciones discretas, sin borde.
// - soft: destacada pero no principal (ámbar suave).
// - danger: borrar, expulsar, salir (rojo macizo).
// - dangerOutline: lo mismo, cuando no es la acción principal.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "dangerOutline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-hover)] shadow-sm hover:shadow-md",
  secondary:
    "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost:
    "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]",
  soft:
    "bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/30 hover:border-[var(--primary)]/60",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  dangerOutline:
    "text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger-soft)]",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs sm:text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm sm:text-base",
};

/** Las clases de un botón, para un <Link>, un <label> o un <a>. */
export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${block ? " w-full" : ""}${className ? ` ${className}` : ""}`;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Muestra un spinner y desactiva el botón. */
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block = false, loading = false, className = "", type = "button", disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {loading && <Spinner size="xs" tone="current" />}
      {children}
    </button>
  );
});

export default Button;

/** Un enlace con pinta de botón. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, className })} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Botón de solo icono. `label` es obligatorio: es lo que lee un lector de
 * pantalla y lo que sale al pasar el ratón.
 */
export function IconButton({
  label,
  tone = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  /** `onImage` para botones sobre fotos (visor, portadas). */
  tone?: "default" | "onImage";
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const look =
    tone === "onImage"
      ? "rounded-full bg-black/50 text-white hover:bg-black/70"
      : "rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${box} shrink-0 inline-flex items-center justify-center transition-colors ${look} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** La ✕ de cerrar de modales y paneles. */
export function CloseButton({ label = "Cerrar", ...rest }: Omit<React.ComponentProps<typeof IconButton>, "label" | "children"> & { label?: string }) {
  return (
    <IconButton label={label} {...rest}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </IconButton>
  );
}
