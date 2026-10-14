"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "@/lib/theme";
import type { NavUser } from "@/lib/navUser";

// Tu cuenta en la cabecera de escritorio: un círculo con tu inicial que abre
// lo que antes iba suelto (BGG, admin, tema) y el cierre de sesión. En el
// móvil esto mismo vive en el menú lateral de la navbar.

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Claro",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Sistema",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Oscuro",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
];

const ITEM =
  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors";

export default function AccountMenu({
  user,
  active,
  loggingOut,
  onLogout,
}: {
  /** null mientras no se sabe quién eres: se guarda el hueco. */
  user: NavUser | null;
  /** Estás en tu perfil, tu colección o editándolo. */
  active: boolean;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, pickTheme, mounted } = useTheme();

  // Se cierra al pulsar fuera o con Escape. Sin fondo `fixed` que lo tape
  // todo: la navbar lleva backdrop-filter y ese fondo quedaría encerrado en
  // ella.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return <span className="w-9 h-9" aria-hidden />;

  const initial = (user.name.trim()[0] || "?").toUpperCase();
  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tu cuenta"
        className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-200 ${
          active || open
            ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--accent-soft)]"
            : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--primary)]/60 hover:text-[var(--primary)]"
        }`}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl z-50 animate-[fade-in_0.15s_ease-out]"
        >
          {/* Quién eres y cómo está tu BGG */}
          <div className="px-3 pt-2 pb-3 mb-1 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text)] truncate">{user.name || "Tu cuenta"}</p>
            {user.bggUsername ? (
              <a
                href={`https://boardgamegeek.com/user/${user.bggUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <Image src="/bgg-icon.svg" alt="BGG" width={12} height={12} className="w-3 h-auto" />
                @{user.bggUsername}
              </a>
            ) : (
              <Link
                href="/profile"
                onClick={close}
                className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[11px] font-medium text-[var(--primary)] hover:border-[var(--primary)]/50"
              >
                <Image src="/bgg-icon.svg" alt="BGG" width={12} height={12} className="w-3 h-auto" />
                Conecta tu BGG y trae tu colección
              </Link>
            )}
          </div>

          <Link href={user.profileHref} onClick={close} role="menuitem" className={ITEM}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Ver mi perfil
          </Link>
          <Link href="/profile" onClick={close} role="menuitem" className={ITEM}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Editar perfil
          </Link>
          {user.isSuperadmin && (
            <Link
              href="/admin"
              onClick={close}
              role="menuitem"
              className={`${ITEM} !text-purple-600 dark:!text-purple-300 hover:!bg-purple-500/10`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Modo administrador
            </Link>
          )}

          {/* Tema: los tres a la vista, sin tener que adivinar qué hace el icono */}
          <div className="mt-1 pt-2 px-1.5 pb-1.5 border-t border-[var(--border)]">
            <p className="px-1.5 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Tema</p>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--surface-alt)]">
              {THEMES.map((t) => {
                const selected = mounted && theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={(e) => pickTheme(t.value, e)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                      selected
                        ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-1 pt-1 border-t border-[var(--border)]">
            <button
              onClick={onLogout}
              disabled={loggingOut}
              role="menuitem"
              className={`${ITEM} hover:!text-rose-500 dark:hover:!text-rose-400 disabled:opacity-50`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
