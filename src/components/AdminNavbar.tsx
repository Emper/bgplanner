"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";

const navItems = [
  { href: "/admin", label: "Resumen", match: "/admin", exact: true },
  { href: "/admin/groups", label: "Grupos", match: "/admin/groups" },
  { href: "/admin/events", label: "Eventos", match: "/admin/events" },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  return (
    <>
      <div className="bg-purple-600 text-white text-[11px] font-medium tracking-wide uppercase text-center py-1.5 px-3">
        Modo administrador · Estás viendo datos de toda la plataforma
      </div>
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] px-3 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/admin"
            prefetch={false}
            className="flex items-center gap-2 text-purple-600 dark:text-purple-300 font-display font-semibold text-base"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            BG Admin
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.match
                : pathname.startsWith(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`relative text-xs sm:text-sm font-medium transition-colors whitespace-nowrap group ${
                    isActive ? "text-purple-600 dark:text-purple-300" : "text-[var(--text-secondary)] hover:text-purple-600 dark:hover:text-purple-300"
                  }`}
                >
                  {item.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-purple-500 rounded-full transition-all duration-300 ${
                    isActive ? "w-full" : "w-0 group-hover:w-full"
                  }`} />
                </Link>
              );
            })}
            <Link
              href="/groups"
              prefetch={false}
              className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] whitespace-nowrap"
              title="Volver a la app como usuario"
            >
              Volver a la app
            </Link>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-purple-600 hover:bg-purple-500/10 transition-all duration-200"
              title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {!mounted ? (
                <span className="w-[18px] h-[18px]" />
              ) : resolvedTheme === "dark" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
