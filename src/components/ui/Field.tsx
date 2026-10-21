import { forwardRef, useId } from "react";

// Campos de formulario. Mismo fondo, borde, foco y placeholder en toda la
// app (había casi cincuenta variantes, y en el admin el foco ni se veía).

export type FieldSize = "sm" | "md" | "lg";
export type FieldTone = "default" | "danger";

const SIZES: Record<FieldSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

const TONES: Record<FieldTone, string> = {
  default: "focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]",
  danger: "focus:ring-[var(--danger)]/40 focus:border-[var(--danger)]",
};

/** Las clases de un campo, para inputs que no pasan por estos componentes. */
export function fieldClass({
  size = "md",
  tone = "default",
  className = "",
}: { size?: FieldSize; tone?: FieldTone; className?: string } = {}): string {
  return `w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 disabled:opacity-60 transition-all duration-200 ${SIZES[size]} ${TONES[tone]}${className ? ` ${className}` : ""}`;
}

type Sized = { size?: FieldSize; tone?: FieldTone };

export const Input = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & Sized>(
  function Input({ size, tone, className = "", ...rest }, ref) {
    return <input ref={ref} className={fieldClass({ size, tone, className })} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & Sized>(
  function Textarea({ size, tone, className = "", ...rest }, ref) {
    return <textarea ref={ref} className={fieldClass({ size, tone, className: `resize-y ${className}` })} {...rest} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & Sized>(
  function Select({ size, tone, className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} className={fieldClass({ size, tone, className })} {...rest}>
        {children}
      </select>
    );
  }
);

export const LABEL_CLASS = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";

/**
 * Etiqueta + campo + ayuda o error. El campo va como hijo; si se le pasa una
 * función, recibe el id para enlazarlo con la etiqueta.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  className = "",
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode | ((id: string) => React.ReactNode);
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      {typeof children === "function" ? children(id) : children}
      {error ? <FieldError className="mt-1.5">{error}</FieldError> : hint ? (
        <p className="text-xs text-[var(--text-muted)] mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

/** Un error en línea bajo un campo o un formulario. */
export function FieldError({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={`text-sm text-[var(--danger)] ${className}`}>
      {children}
    </p>
  );
}

/** Interruptor de sí/no con su etiqueta. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
        {description && <span className="block text-xs text-[var(--text-muted)] mt-0.5">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
