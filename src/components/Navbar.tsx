"use client";

import Link from "next/link";
import AnimatedLogo from "./AnimatedLogo";

export default function Navbar() {
  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-3 sm:px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/groups"
          prefetch={false}
          className="flex items-center"
        >
          <AnimatedLogo />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          {[
            { href: "/groups", label: "Grupos" },
            { href: "/events", label: "Eventos" },
            { href: "/profile", label: "Perfil" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="relative text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap group"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 transition-all duration-300 group-hover:w-full rounded-full" />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
