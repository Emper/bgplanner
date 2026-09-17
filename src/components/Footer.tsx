"use client";

import Link from "next/link";
import Image from "next/image";

// Enlaces fijos para todo el mundo, con o sin sesión: antes se consultaba el
// perfil antes de pintarlos y aparecían tarde (o no aparecían).
const LINKS = [
  { href: "/changelog", label: "Changelog" },
  { href: "/roadmap", label: "Ideas y mejoras" },
  { href: "/contact", label: "Contacto" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-16 py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="font-medium">© {new Date().getFullYear()} BG Planner</span>
          {LINKS.map((link) => (
            <span key={link.href} className="flex items-center gap-4">
              <span className="text-[var(--border)]">·</span>
              <Link href={link.href} className="hover:text-[var(--primary)] transition-colors">
                {link.label}
              </Link>
            </span>
          ))}
        </div>
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <Image
            src="/powered-by-bgg.svg"
            alt="Powered by BoardGameGeek"
            width={120}
            height={27}
            className="h-[27px] w-auto"
          />
        </a>
      </div>
    </footer>
  );
}
