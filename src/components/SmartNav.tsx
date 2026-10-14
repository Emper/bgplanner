"use client";

import Link from "next/link";
import Navbar from "./Navbar";
import AnimatedLogo from "./AnimatedLogo";
import { useTheme } from "@/lib/theme";
import { usePathname } from "next/navigation";
import { useNavUser } from "@/lib/navUser";

// Lo que se puede recorrer sin cuenta. En móvil van como icono para que
// quepan junto a «Entrar».
const PUBLIC_LINKS = [
  { href: "/events", label: "Eventos", icon: "calendar" },
  { href: "/community", label: "Comunidad", icon: "chat" },
] as const;

export default function SmartNav() {
  // Comparte con la navbar lo que ya se sabe de la sesión: quien ya ha
  // entrado ve su cabecera desde el principio, sin pasar por la de visitante.
  const navUser = useNavUser();
  const isLoggedIn = navUser === undefined ? null : !!navUser;
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const pathname = usePathname();

  if (isLoggedIn === true) {
    return <Navbar />;
  }

  return (
    <nav className="px-4 sm:px-6 py-4 border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <AnimatedLogo />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {PUBLIC_LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                title={l.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center text-sm font-medium transition-colors ${
                  active ? "text-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--primary)]"
                }`}
              >
                <span className="sm:hidden">
                  {l.icon === "chat" ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
                  )}
                </span>
                <span className="sr-only sm:not-sr-only">{l.label}</span>
              </Link>
            );
          })}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
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
          {isLoggedIn === false && (
            <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
