"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "./Navbar";
import AnimatedLogo from "./AnimatedLogo";
import { useTheme } from "@/lib/theme";

export default function SmartNav() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  if (isLoggedIn === true) {
    return <Navbar />;
  }

  return (
    <nav className="px-4 sm:px-6 py-4 border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <AnimatedLogo />
        </Link>
        <div className="flex items-center gap-3">
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
