"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AnimatedLogo from "./AnimatedLogo";
import ThemeToggleButton from "./ThemeToggleButton";

// La cabecera de quien no ha entrado, igual en la portada y en las páginas
// públicas. Eventos y Comunidad van siempre con su nombre, también en el
// móvil: a 360 px caben junto al logo y «Entrar» si el tema se queda para
// pantallas más anchas (en el móvil se sigue el del sistema). Por debajo de
// 380 px el logo encoge un poco (AnimatedLogo) para que no se salga nada.

const PUBLIC_LINKS = [
  { href: "/events", label: "Eventos" },
  { href: "/community", label: "Comunidad" },
];

export type NavSection = { href: string; label: string };

export default function PublicNav({
  loginHref,
  sections,
}: {
  loginHref: string;
  /** Anclas de la portada: sustituyen a los enlaces públicos desde md. */
  sections?: NavSection[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-40 px-3 sm:px-6 py-3 border-b transition-colors duration-300 ${
        scrolled
          ? "bg-[var(--bg)]/80 backdrop-blur-xl border-[var(--border)]"
          : "border-transparent"
      }`}
    >
      <div className={`max-w-6xl mx-auto flex items-center justify-between gap-2`}>
        <Link href="/" className="flex items-center shrink-0">
          <AnimatedLogo />
        </Link>

        {sections && (
          <div className="hidden md:flex items-center gap-1 text-sm">
            {sections.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4">
          {PUBLIC_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`${sections ? "md:hidden" : ""} text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "text-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--primary)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <span className="hidden sm:flex">
            <ThemeToggleButton />
          </span>
          <Link
            href={loginHref}
            className="px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold text-[13px] sm:text-sm whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Entrar
          </Link>
        </div>
      </div>
    </nav>
  );
}
