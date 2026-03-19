"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/groups"
          className="text-xl font-bold text-amber-400 tracking-tight"
        >
          WeBoard
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/groups"
            className="text-sm text-slate-300 hover:text-amber-400 transition-colors"
          >
            Mis Grupos
          </Link>
          <Link
            href="/profile"
            className="text-sm text-slate-300 hover:text-amber-400 transition-colors"
          >
            Mi Perfil
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {loggingOut ? "Saliendo..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </nav>
  );
}
