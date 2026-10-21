"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import PageLoader from "@/components/PageLoader";
import { safeRedirect } from "@/lib/safeRedirect";
import Button from "@/components/ui/Button";
import { Field, FieldError, Input } from "@/components/ui/Field";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (res.ok) {
          router.replace(redirect || "/");
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
    return <PageLoader fullScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[var(--glow)] rounded-full blur-[120px] pointer-events-none" />

      <ThemeToggleButton className="absolute top-4 right-4 z-10" />

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
          <h1 className="text-xl font-bold text-[var(--text)] mb-5">
            Iniciar sesión
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Correo electrónico" htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </Field>

            <FieldError>{error}</FieldError>

            <Button type="submit" size="lg" block loading={loading} className="py-3">
              {loading ? "Enviando…" : "Enviar código de acceso"}
            </Button>

            <p className="text-xs text-[var(--text-muted)] text-center leading-relaxed">
              Al entrar aceptas los{" "}
              <Link href="/terms" className="text-[var(--text-secondary)] underline hover:text-[var(--primary)]">
                términos de uso
              </Link>{" "}
              y la{" "}
              <Link href="/privacy" className="text-[var(--text-secondary)] underline hover:text-[var(--primary)]">
                política de privacidad
              </Link>
              . No hay sitio para el acoso ni el contenido ofensivo.
            </p>
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
      fallback={<PageLoader fullScreen />}
    >
      <LoginForm />
    </Suspense>
  );
}
