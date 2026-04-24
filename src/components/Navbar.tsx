"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import AnimatedLogo from "./AnimatedLogo";
import { useTheme } from "@/lib/theme";

export default function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  // null = loading, "" = no username, string = username
  const [bggUsername, setBggUsername] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setBggUsername(data?.bggUsername || "");
        setIsSuperadmin(!!data?.isSuperadmin);
      })
      .catch(() => setBggUsername(""));
  }, []);

  const navItems = [
    { href: "/groups", label: "Grupos", match: "/groups" },
    { href: "/events", label: "Eventos", match: "/events" },
    { href: "/profile", label: "Perfil", match: "/profile" },
  ];

  const isConnected = bggUsername !== null && bggUsername !== "";

  const bggBadge = bggUsername !== null ? (
    isConnected ? (
      <a
        href={`https://boardgamegeek.com/user/${bggUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition-all duration-200"
        title={`@${bggUsername} en BoardGameGeek`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <Image src="/bgg-icon.svg" alt="BGG" width={14} height={14} className="w-[14px] h-auto" />
        <span className="text-[11px] font-medium leading-none">@{bggUsername}</span>
      </a>
    ) : (
      <div
        className="relative hidden sm:inline-flex"
        onMouseEnter={() => { clearTimeout(tooltipTimeout.current); setShowTooltip(true); }}
        onMouseLeave={() => { tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 150); }}
      >
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/15 transition-all duration-200"
        >
          <Image src="/bgg-icon.svg" alt="BGG" width={14} height={14} className="w-[14px] h-auto" />
          <span className="text-[11px] font-medium leading-none">Conectar BGG</span>
        </Link>
        {showTooltip && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg z-50 text-xs text-[var(--text-secondary)] leading-relaxed">
            <p className="font-medium text-[var(--text)] mb-1">Vincula tu cuenta de BGG</p>
            <p>Conecta tu usuario de BoardGameGeek para importar tu colección de juegos y compartirla con tus grupos.</p>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[var(--surface)] border-l border-t border-[var(--border)]" />
          </div>
        )}
      </div>
    )
  ) : (
    // Placeholder while loading to prevent layout shift
    <span className="hidden sm:inline-flex w-[120px] h-[30px]" />
  );

  return (
    <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] px-3 sm:px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/groups"
          prefetch={false}
          className="flex items-center"
        >
          <AnimatedLogo />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          {bggBadge}
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`relative text-xs sm:text-sm font-medium transition-colors whitespace-nowrap group ${
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
          {isSuperadmin && (
            <Link
              href="/admin"
              prefetch={false}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:border-purple-500/60 hover:bg-purple-500/20 transition-all duration-200 text-[11px] font-medium leading-none whitespace-nowrap"
              title="Entrar en modo administrador"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Admin
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
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
  );
}
