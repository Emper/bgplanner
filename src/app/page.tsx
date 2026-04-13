"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import Footer from "@/components/Footer";
import { useTheme } from "@/lib/theme";

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="16" r="1.5" fill="currentColor" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    title: "Grupos",
    description: "Crea grupos con tus amigos, importa juegos de vuestra colección de BGG y decidid juntos qué jugar.",
    gradient: "from-amber-500/10 to-orange-500/10",
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    title: "Ranking y votos",
    description: "Vota los juegos que más te apetecen. Usa el supervoto para tus favoritos y descubre los más populares.",
    gradient: "from-yellow-500/10 to-amber-500/10",
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
    title: "Sesiones",
    description: "Planifica sesiones de juego. WeBoard te sugiere los mejores juegos según tiempo, jugadores y votos.",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: "Eventos",
    description: "Organiza jornadas y quedadas abiertas. Los asistentes marcan sus prioridades y montan su lista.",
    gradient: "from-violet-500/10 to-purple-500/10",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Regístrate con tu email",
    description: "Sin contraseñas. Te enviamos un código de acceso cada vez que entras.",
  },
  {
    num: "02",
    title: "Crea o únete a un grupo",
    description: "Invita a tus amigos con un enlace. Importa vuestra colección de BGG.",
  },
  {
    num: "03",
    title: "Vota y juega",
    description: "Vota tus juegos favoritos, planifica sesiones y organiza eventos.",
  },
];

/* Floating decorative board game elements */
function FloatingElements() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Meeple top-right */}
      <svg className="absolute top-16 right-[12%] w-12 h-12 text-[var(--primary)] opacity-[0.08] animate-float-slow" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93L15 22H9l2.25-12.07A4.002 4.002 0 0112 2z" />
      </svg>
      {/* Die top-left */}
      <svg className="absolute top-32 left-[8%] w-10 h-10 text-[var(--accent)] opacity-[0.07] animate-float delay-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
        <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
      </svg>
      {/* Hex bottom-right */}
      <svg className="absolute bottom-40 right-[15%] w-14 h-14 text-[var(--primary)] opacity-[0.06] animate-float delay-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
      </svg>
      {/* Card shape left */}
      <svg className="absolute bottom-60 left-[10%] w-8 h-8 text-[var(--text-muted)] opacity-[0.06] animate-float-slow delay-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="1" width="18" height="22" rx="3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {/* Abstract dots / tokens */}
      <div className="absolute top-[55%] right-[6%] w-3 h-3 rounded-full bg-[var(--primary)] opacity-[0.1] animate-float delay-200" />
      <div className="absolute top-[30%] left-[18%] w-2 h-2 rounded-full bg-[var(--accent)] opacity-[0.08] animate-float-slow delay-400" />
      <div className="absolute bottom-[25%] left-[22%] w-4 h-4 rounded-full border border-[var(--primary)] opacity-[0.06] animate-float delay-600" />
    </div>
  );
}

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const { resolvedTheme, toggleTheme } = useTheme();

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
      {/* Navbar */}
      <nav className="px-4 sm:px-6 py-4 animate-fade-in">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <AnimatedLogo />
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
              title={resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              {resolvedTheme === "dark" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link
              href="/login"
              className="px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-4 pt-16 sm:pt-28 pb-20 sm:pb-32">
        <FloatingElements />

        {/* Radial glow behind headline */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[var(--glow)] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="animate-fade-up">
            <span className="inline-block px-3 py-1 text-xs font-medium tracking-wide uppercase rounded-full bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/20 mb-6">
              Conectado con BoardGameGeek
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1] mb-5 animate-fade-up delay-100 tracking-tight">
            Organiza tus noches{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
                de juegos de mesa
              </span>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up delay-200">
            Vota qué jugar, planifica sesiones, organiza eventos y descubre los favoritos de tu grupo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up delay-300">
            <Link
              href="/login"
              className="group relative inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-2xl hover:bg-[var(--primary-hover)] font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Empieza gratis
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <span className="text-sm text-[var(--text-muted)]">
              Sin contraseñas · Siempre gratis
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 animate-fade-up delay-400">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Todo para jugar mejor
            </h2>
            <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
              Herramientas pensadas para grupos de juegos de mesa
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`group relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-7 transition-all duration-300 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] animate-fade-up delay-${(i + 5) * 100}`}
                style={{ animationDelay: `${(i + 5) * 100}ms` }}
              >
                {/* Subtle gradient bg on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--primary)] mb-4 transition-transform duration-300 group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text)] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14 tracking-tight animate-fade-up">
            Así de fácil
          </h2>
          <div className="space-y-0">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="group flex gap-5 items-start animate-fade-up relative"
                style={{ animationDelay: `${(i + 1) * 150}ms` }}
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[23px] top-12 w-px h-[calc(100%-12px)] bg-gradient-to-b from-[var(--border)] to-transparent" />
                )}

                <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-[var(--primary-text)] font-bold text-sm shrink-0 shadow-md">
                  {step.num}
                </div>
                <div className="pt-1 pb-10">
                  <h3 className="font-bold text-[var(--text)] text-lg">{step.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          <div className="relative bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-10 sm:p-14 overflow-hidden">
            {/* Background glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--glow)] rounded-full blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[var(--glow)] rounded-full blur-[80px] opacity-50" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                ¿Listo para la próxima partida?
              </h2>
              <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
                Únete a WeBoard y organiza tus juegos de mesa como nunca.
              </p>
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-2xl hover:bg-[var(--primary-hover)] font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Crear cuenta gratis
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
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
