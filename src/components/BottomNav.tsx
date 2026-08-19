"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra de navegación inferior, solo en móvil.
 *
 * Sustituye a la hamburguesa de la Navbar: las secciones principales pasan a
 * la zona del pulgar, que es donde se navega de verdad en un móvil.
 */

type Item = {
  href: string;
  label: string;
  /** Prefijos de ruta que marcan esta pestaña como activa. */
  match: string[];
  icon: (active: boolean) => React.ReactNode;
};

const stroke = (active: boolean) => (active ? 2.1 : 1.7);

const ITEMS: Item[] = [
  {
    href: "/inicio",
    label: "Inicio",
    match: ["/inicio"],
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    href: "/groups",
    label: "Grupos",
    match: ["/groups"],
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.479m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Eventos",
    match: ["/events"],
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Perfil",
    match: ["/profile"],
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

/** Rutas donde la barra inferior no pinta nada (login, invitaciones, admin…). */
const HIDDEN_PREFIXES = [
  "/login",
  "/auth",
  "/admin",
  "/invite",
  "/join",
  "/join-event",
];

export function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === "/") return false;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return ITEMS.some((item) => item.match.some((m) => pathname.startsWith(m)));
}

export default function BottomNav() {
  const pathname = usePathname();
  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)]/90 backdrop-blur-xl border-t border-[var(--border)] pb-safe"
    >
      <ul className="flex items-stretch justify-around h-[var(--bottom-nav-h)]">
        {ITEMS.map((item) => {
          const active = item.match.some((m) => pathname.startsWith(m));
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                }`}
              >
                <span className="w-6 h-6">{item.icon(active)}</span>
                <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
