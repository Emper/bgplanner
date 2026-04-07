"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";

const FEATURES = [
  {
    icon: "🎲",
    title: "Grupos",
    description: "Crea grupos con tus amigos, importa juegos de vuestra colección de BoardGameGeek y decidid juntos qué jugar.",
  },
  {
    icon: "🏆",
    title: "Ranking y votos",
    description: "Vota los juegos que más te apetecen. Usa el supervoto para tus favoritos y descubre los más populares del grupo.",
  },
  {
    icon: "📅",
    title: "Sesiones",
    description: "Planifica sesiones de juego. WeBoard te sugiere los mejores juegos según tiempo disponible, jugadores y votos.",
  },
  {
    icon: "🎪",
    title: "Eventos",
    description: "Organiza jornadas y quedadas abiertas. Los asistentes marcan sus prioridades y montan su lista personalizada.",
  },
];

const STEPS = [
  { num: "1", title: "Regístrate con tu email", description: "Sin contraseñas. Te enviamos un código de acceso cada vez que entras." },
  { num: "2", title: "Crea o únete a un grupo", description: "Invita a tus amigos con un enlace. Importa vuestra colección de BGG." },
  { num: "3", title: "Vota y juega", description: "Vota tus juegos favoritos, planifica sesiones y organiza eventos." },
];

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";

  const [checkingSession, setCheckingSession] = useState(true);

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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Navbar mínimo */}
      <nav className="px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <AnimatedLogo />
          <Link
            href="/login"
            className="px-4 py-2 bg-amber-500 text-[var(--bg)] rounded-lg hover:bg-amber-600 font-medium text-sm transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Organiza tus juegos de mesa<br />
            <span className="text-amber-400">con tus amigos</span>
          </h1>
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
            Vota qué jugar, planifica sesiones, organiza eventos y descubre los favoritos de tu grupo. Todo conectado con BoardGameGeek.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-amber-500 text-[var(--bg)] rounded-xl hover:bg-amber-600 font-semibold text-lg transition-colors"
          >
            Empieza gratis
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            Todo lo que necesitas para jugar mejor
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 sm:p-6"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            Así de fácil
          </h2>
          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">{step.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-[var(--surface)]">
        <div className="max-w-5xl mx-auto text-center text-sm text-[var(--text-muted)]">
          <p>
            Hecho con dados y café.{" "}
            <a
              href="https://boardgamegeek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-amber-400 transition-colors"
            >
              Datos de BoardGameGeek
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          Cargando...
        </div>
      }
    >
      <LandingPage />
    </Suspense>
  );
}
