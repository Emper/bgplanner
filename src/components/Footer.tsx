"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

// Páginas que ya enlazan de forma destacada a otra dentro del contenido: no
// hace falta repetir ese enlace en el pie. La página actual se quita siempre.
const REDUNDANT_LINKS: Record<string, string[]> = {
  "/roadmap": ["/feedback"],
  "/feedback": ["/roadmap"],
};

export default function Footer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => {});
  }, []);

  const links = [
    { href: "/changelog", label: "Changelog" },
    { href: "/roadmap", label: "Roadmap" },
    ...(isLoggedIn ? [{ href: "/feedback", label: "Feedback" }] : []),
    { href: "/contact", label: "Contacto" },
  ].filter(
    (link) =>
      link.href !== pathname && !(REDUNDANT_LINKS[pathname] || []).includes(link.href)
  );

  return (
    <footer className="border-t border-[var(--border)] mt-16 py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span className="font-medium">© {new Date().getFullYear()} BG Planner</span>
          {links.map((link) => (
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
