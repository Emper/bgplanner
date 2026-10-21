"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AnimatedLogo from "./AnimatedLogo";
import NotificationBell from "./NotificationBell";
import AccountMenu, { AccountPanel } from "./AccountMenu";
import { useNavUser, clearNavUser } from "@/lib/navUser";
import { disablePush } from "@/lib/pushClient";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { CloseButton } from "./ui/Button";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  // Lo último conocido de quien navega, para no ir colocando piezas a
  // destiempo en cada página. Mientras no se sabe, huecos del mismo tamaño.
  const navUser = useNavUser();
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
  useEscapeKey(() => setMenuOpen(false), menuOpen);

  // Desde sm, las secciones en texto junto a la campana y tu cuenta. En móvil
  // van en la barra de pestañas de abajo (MobileTabBar). La colección y el
  // perfil no son secciones: van en tu cuenta (AccountPanel), que en
  // escritorio es el desplegable y en móvil el menú lateral.
  const navItems = [
    { href: "/groups", label: "Grupos", match: "/groups" },
    { href: "/events", label: "Eventos", match: "/events" },
    { href: "/community", label: "Comunidad", match: "/community" },
  ];

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
            {/* Móvil: tu cuenta, lo mismo que el desplegable de escritorio */}
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

      {/* Menú lateral del móvil: tu cuenta (las secciones van en la barra de abajo) */}
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
              <CloseButton label="Cerrar menú" onClick={() => setMenuOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {navUser && (
                <AccountPanel
                  user={navUser}
                  loggingOut={loggingOut}
                  onLogout={handleLogout}
                  onNavigate={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
