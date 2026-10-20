"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "./AnimatedLogo";
import NotificationBell from "./NotificationBell";
import AccountMenu from "./AccountMenu";
import { useTheme } from "@/lib/theme";
import { useNavUser, clearNavUser } from "@/lib/navUser";
import { disablePush } from "@/lib/pushClient";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  // Lo último conocido de quien navega, para no ir colocando piezas a
  // destiempo en cada página. Mientras no se sabe, huecos del mismo tamaño.
  const navUser = useNavUser();
  // null = loading, "" = no username, string = username
  const bggUsername = navUser ? navUser.bggUsername : null;
  const isSuperadmin = !!navUser?.isSuperadmin;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // "Perfil" lleva al perfil público, que es el que se enseña; editarlo está
  // a un clic desde allí. Hasta que sabemos quiénes somos, al formulario.
  const myProfile = navUser?.profileHref ?? "/profile";

  // Bloquea el scroll del body cuando el menú está abierto
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  // Desde sm, las secciones en texto junto a la campana y tu cuenta. En móvil
  // van en la barra de pestañas de abajo (MobileTabBar). La colección, como
  // en el móvil, no es una sección: está en tu cuenta (AccountMenu) y en el
  // menú lateral.
  const navItems = [
    { href: "/groups", label: "Grupos", match: "/groups" },
    { href: "/events", label: "Eventos", match: "/events" },
    { href: "/community", label: "Comunidad", match: "/community" },
  ];

  const isConnected = bggUsername !== null && bggUsername !== "";
  const profileActive =
    pathname.startsWith("/profile") || pathname === myProfile;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Antes de cerrar la sesión, que hace falta para desapuntar el
      // dispositivo: si no, seguirían llegando los avisos de esta cuenta.
      await disablePush().catch(() => {});
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      clearNavUser();
      // "/" pinta tu inicio o la portada según haya sesión: que no se quede
      // el inicio de antes en la caché del router.
      router.push("/");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] px-3 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" prefetch={false} className="flex items-center">
            <AnimatedLogo />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`hidden sm:inline relative text-sm font-medium transition-colors whitespace-nowrap group ${
                    isActive ? "text-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--primary)]"
                  }`}
                >
                  {item.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-[var(--primary)] rounded-full transition-all duration-300 ${
                    isActive ? "w-full" : "w-0 group-hover:w-full"
                  }`} />
                </Link>
              );
            })}
            <NotificationBell />
            {/* Escritorio: tu cuenta, con BGG, admin, tema y cerrar sesión */}
            <div className="hidden sm:block">
              <AccountMenu
                user={navUser ?? null}
                active={profileActive || pathname.startsWith("/collection")}
                loggingOut={loggingOut}
                onLogout={handleLogout}
              />
            </div>
            {/* Móvil: menú con lo que no cabe en la barra de abajo */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Menú lateral del móvil: lo que no está en la barra de pestañas */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          onClick={() => setMenuOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-display font-semibold text-[var(--text)]">Menú</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {/* BGG estado */}
              {bggUsername !== null && (
                isConnected ? (
                  <a
                    href={`https://boardgamegeek.com/user/${bggUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Image src="/bgg-icon.svg" alt="BGG" width={16} height={16} className="w-4 h-auto" />
                    <span className="text-sm font-medium">@{bggUsername}</span>
                  </a>
                ) : (
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]"
                  >
                    <Image src="/bgg-icon.svg" alt="BGG" width={16} height={16} className="w-4 h-auto" />
                    <span className="text-sm font-medium">Conectar BGG</span>
                  </Link>
                )
              )}

              <Link
                href="/collection"
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname.startsWith("/collection")
                    ? "bg-[var(--accent-soft)] text-[var(--primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Mi colección
              </Link>

              {isSuperadmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  Modo administrador
                </Link>
              )}

              <button
                onClick={() => { toggleTheme(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
              >
                {!mounted ? (
                  <span className="w-5 h-5" />
                ) : resolvedTheme === "dark" ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {!mounted ? "Cambiar de tema" : resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro"}
              </button>
            </div>

            {/* Logout — separado abajo */}
            <div className="px-4 py-3 border-t border-[var(--border)]">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
