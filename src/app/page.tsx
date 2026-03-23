"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-500">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Navbar mínimo */}
      <nav className="px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Image src="/logo.svg" alt="WeBoard" width={160} height={40} priority />
          <a
            href="#join"
            className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium text-sm transition-colors"
          >
            Entrar
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Organiza tus juegos de mesa{" "}
            <span className="text-amber-400">en grupo</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Vota qué jugar, planifica sesiones, organiza eventos y descubre los favoritos de tu grupo. Todo conectado con BoardGameGeek.
          </p>
          <a
            href="#join"
            className="inline-block px-8 py-3 bg-amber-500 text-slate-900 rounded-xl hover:bg-amber-600 font-semibold text-lg transition-colors"
          >
            Empieza gratis
          </a>
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
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 sm:p-6"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
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
                  <h3 className="font-semibold text-slate-100">{step.title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join / Login section */}
      <section id="join" className="px-4 py-12 sm:py-20 scroll-mt-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Únete a WeBoard</h2>
            <p className="text-slate-400 mt-2">
              Sin contraseñas. Introduce tu email y te enviamos un código de acceso.
            </p>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-200 mb-1"
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
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
              >
                {loading ? "Enviando..." : "Enviar código de acceso"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-slate-800">
        <div className="max-w-5xl mx-auto text-center text-sm text-slate-500">
          <p>
            Hecho con dados y café.{" "}
            <a
              href="https://boardgamegeek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-amber-400 transition-colors"
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
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-500">
          Cargando...
        </div>
      }
    >
      <LandingPage />
    </Suspense>
  );
}
