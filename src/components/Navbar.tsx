"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AnimatedLogo from "./AnimatedLogo";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/groups", label: "Grupos", match: "/groups" },
    { href: "/events", label: "Eventos", match: "/events" },
    { href: "/profile", label: "Perfil", match: "/profile" },
  ];

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
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`relative text-xs sm:text-sm transition-colors whitespace-nowrap group ${
                  isActive ? "text-amber-400" : "text-slate-300 hover:text-amber-400"
                }`}
              >
                {item.label}
                <span className={`absolute -bottom-1 left-0 h-0.5 bg-amber-400 rounded-full transition-all duration-300 ${
                  isActive ? "w-full" : "w-0 group-hover:w-full"
                }`} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
