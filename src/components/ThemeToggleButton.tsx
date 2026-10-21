"use client";

import { useTheme } from "@/lib/theme";

// El botón sol/luna de cambiar de tema (cabecera pública, login, admin). Enseña lo
// que pasará al pulsarlo: el sol en oscuro, la luna en claro. Hasta saber el
// tema (tras montar) guarda el hueco para que no salte nada.

export default function ThemeToggleButton({
  className = "",
  accent = "primary",
}: {
  className?: string;
  /** `admin` para el morado del panel de administración. */
  accent?: "primary" | "admin";
}) {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const label = !mounted ? "Cambiar de tema" : resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${
        accent === "admin"
          ? "hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-500/10 focus-visible:ring-purple-500/40"
          : "hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] focus-visible:ring-[var(--primary)]/40"
      } ${className}`}
    >
      {!mounted ? (
        <span className="w-[18px] h-[18px]" />
      ) : resolvedTheme === "dark" ? (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
