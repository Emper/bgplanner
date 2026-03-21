"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AnimatedLogo from "./AnimatedLogo";

export default function Navbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/");
    } catch {
      setLoggingOut(false);
    }
  };

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
            href="/profile"
            prefetch={false}
            className="text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Perfil
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs sm:text-sm text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loggingOut ? "..." : "Salir"}
          </button>
        </div>
      </div>
    </nav>
  );
}
