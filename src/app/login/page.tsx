"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { useTheme } from "@/lib/theme";
import PageLoader from "@/components/PageLoader";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (res.ok) {
          router.replace(redirect || "/groups");
          return;
        }
      } catch {
        // Not logged in
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar el código");
      }

      const params = new URLSearchParams({ email });
      if (redirect) params.set("redirect", redirect);
      router.push(`/auth/verify?${params.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[var(--glow)] rounded-full blur-[120px] pointer-events-none" />

      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200 z-10"
        title={!mounted ? "Cambiar de tema" : resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro"}
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

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-up">
          <Link href="/" className="inline-block">
            <AnimatedLogo />
          </Link>
          <p className="text-[var(--text-secondary)] mt-4 text-sm leading-relaxed">
            Sin contraseñas. Introduce tu email y te enviamos un código de acceso.
          </p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-7 shadow-[var(--card-shadow)] animate-fade-up delay-100">
          <h2 className="text-xl font-bold text-[var(--text)] mb-5">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--text)] mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-bold text-base transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {loading ? "Enviando..." : "Enviar código de acceso"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-[var(--text-muted)] animate-fade-up delay-200">
          <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
            ← Volver a la página principal
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>}
    >
      <LoginForm />
    </Suspense>
  );
}
