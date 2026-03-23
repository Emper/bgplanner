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
          <Link
            href="/groups"
            prefetch={false}
            className="text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Grupos
          </Link>
          <Link
            href="/events"
            prefetch={false}
            className="text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Eventos
          </Link>
          <Link
            href="/profile"
            prefetch={false}
            className="text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Perfil
          </Link>
        </div>
      </div>
    </nav>
  );
}
