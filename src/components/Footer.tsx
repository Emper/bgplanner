"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export default function Footer() {
  const { resolvedTheme, mounted } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-[var(--border)] mt-16 py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span className="font-medium">© {new Date().getFullYear()} BG Planner</span>
          <span className="text-[var(--border)]">·</span>
          <Link href="/changelog" className="hover:text-[var(--primary)] transition-colors">
            Changelog
          </Link>
          {isLoggedIn && (
            <>
              <span className="text-[var(--border)]">·</span>
              <Link href="/feedback" className="hover:text-[var(--primary)] transition-colors">
                Feedback
              </Link>
            </>
          )}
          <span className="text-[var(--border)]">·</span>
          <Link href="/contact" className="hover:text-[var(--primary)] transition-colors">
            Contacto
          </Link>
        </div>
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          {mounted && (
            <Image
              src={resolvedTheme === "dark" ? "/powered-by-bgg-reversed.svg" : "/powered-by-bgg.svg"}
              alt="Powered by BoardGameGeek"
              width={120}
              height={27}
              className="h-[27px] w-auto"
            />
          )}
        </a>
      </div>
    </footer>
  );
}
