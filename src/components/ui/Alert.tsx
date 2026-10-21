// Un aviso dentro de la página: un error al cargar, una advertencia, un
// «hecho». Para avisos que van y vienen, useToast.

const TONES = {
  error: "bg-[var(--danger-soft)] border-[var(--danger)]/30 text-[var(--danger)]",
  success: "bg-[var(--success-soft)] border-[var(--success)]/30 text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--warning)]",
  info: "bg-[var(--accent-soft)] border-[var(--primary)]/30 text-[var(--text-secondary)]",
};

export default function Alert({
  tone = "error",
  title,
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Un botón a la derecha (Reintentar…). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${TONES[tone]} ${className}`}
    >
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
