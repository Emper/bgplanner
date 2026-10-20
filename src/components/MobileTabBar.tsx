"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavUser } from "@/lib/navUser";

// La barra de pestañas de abajo, como la de una app del móvil. Vive en el
// layout raíz (no en cada página, como la navbar) para no montarse de nuevo
// al navegar. Solo con sesión: quien visita ya tiene Eventos, Comunidad y
// «Entrar» en la cabecera, y aquí lo que importa es que se apunte.

// Donde no hay cabecera de la app (o es otra): ahí la barra sobra.
const HIDDEN_PREFIXES = ["/admin", "/login", "/auth", "/invite", "/join"];

type Tab = {
  href: string;
  label: string;
  /** Rutas que cuentan como «estar en esta pestaña». */
  match: string[];
  icon: React.ReactNode;
};

const ICON = "w-6 h-6";

function isUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const navUser = useNavUser();

  if (!navUser) return null;
  if (HIDDEN_PREFIXES.some((p) => isUnder(pathname, p))) return null;

  // Tu perfil y tu colección van en el menú de la cabecera, como en escritorio
  const tabs: Tab[] = [
    {
      href: "/",
      label: "Inicio",
      match: [],
      icon: (
        <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      href: "/groups",
      label: "Grupos",
      match: ["/groups"],
      icon: (
        <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      href: "/events",
      label: "Eventos",
      match: ["/events"],
      icon: (
        <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      href: "/community",
      label: "Comunidad",
      match: ["/community"],
      icon: (
        <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
    },
  ];

  // Inicio solo cuenta en la portada; el resto, también en sus subpáginas
  const activeIndex = tabs.findIndex((t) =>
    t.href === "/" ? pathname === "/" : t.match.some((m) => isUnder(pathname, m))
  );

  return (
    <>
      {/* Hueco al final de la página para que la barra no tape lo último */}
      <div className="mobile-tabbar-spacer sm:hidden" aria-hidden />
      <nav
        aria-label="Secciones"
        className="mobile-tabbar sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)]/85 backdrop-blur-xl border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <ul className="relative grid grid-cols-4 h-[var(--tabbar-h)]">
          {/* La pastilla de la pestaña activa se desliza de una a otra */}
          {activeIndex >= 0 && (
            <li
              aria-hidden
              className="absolute top-1.5 h-8 w-1/4 flex justify-center pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            >
              <span className="w-14 h-full rounded-full bg-[var(--accent-soft)] dark:bg-[var(--primary)]/12" />
            </li>
          )}
          {tabs.map((tab, i) => {
            const active = i === activeIndex;
            return (
              <li key={tab.label} className="relative">
                <Link
                  href={tab.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    // Como en iOS: en la portada de tu pestaña, tocarla otra
                    // vez te sube arriba del todo. Desde una subpágina (un
                    // grupo, un hilo) te devuelve a la portada.
                    if (pathname === tab.href) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={`h-full flex flex-col items-center justify-center gap-0.5 select-none transition-colors active:scale-95 [-webkit-tap-highlight-color:transparent] ${
                    active ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  <span className="h-8 flex items-center">{tab.icon}</span>
                  <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

