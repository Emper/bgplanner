"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import Footer from "@/components/Footer";
import { useTheme } from "@/lib/theme";
import { MARQUEE_BOTTOM, MARQUEE_TOP, DEMO_GAMES, type DemoGame } from "./games";
import { Reveal, ScrollProgress, usePrefersReducedMotion } from "@/components/motion";
import {
  AppWindow,
  BadgesMini,
  CollectionMock,
  CoupleMini,
  EventMock,
  EventTicketMini,
  GalleryMini,
  GroupSetupMock,
  LiveRanking,
  PickMock,
  PingMini,
  PodiumMock,
  RoadmapMini,
  ShareMini,
  ToastMini,
  VoteMock,
  WinnerMini,
} from "./mockups";

export interface LandingEvent {
  id: string;
  name: string;
  weekday: string;
  day: string;
  month: string;
  time: string;
  location: string | null;
  attendeeCount: number;
  gameCount: number;
  imageUrl: string | null;
}

// ── Navegación ──────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "#grupos", label: "Grupos" },
  { href: "#coleccion", label: "Colección" },
  { href: "#eventos", label: "Eventos" },
  { href: "#mas", label: "Y más" },
];

function Nav({ loginHref }: { loginHref: string }) {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 px-4 sm:px-6 transition-all duration-300 ${
        scrolled
          ? "py-2.5 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)]"
          : "py-4 border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <AnimatedLogo />
        <div className="hidden md:flex items-center gap-1 text-sm">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-all duration-200"
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
          <Link
            href={loginHref}
            className="px-4 sm:px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Entrar
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Piezas sueltas ──────────────────────────────────────────────────────

function Arrow({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} transition-transform group-hover:translate-x-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function PrimaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-2xl hover:bg-[var(--primary-hover)] font-bold text-lg transition-all duration-200 shadow-lg shadow-[var(--glow)] hover:shadow-xl hover:-translate-y-0.5"
    >
      {children}
      <Arrow />
    </Link>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
      {children}
    </span>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 items-start text-sm text-[var(--text-secondary)]">
      <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--accent-soft)] text-[var(--primary)] flex items-center justify-center text-[11px] font-bold shrink-0">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────

const HERO_WORDS = ["esta noche", "el sábado", "en las jornadas", "en pareja", "con los de siempre"];

function RotatingWord() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((n) => (n + 1) % HERO_WORDS.length), 2600);
    return () => clearInterval(id);
  }, [reduced]);
  return (
    <span className="block pb-2 [perspective:600px]">
      <span
        key={i}
        className="landing-word bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)] bg-clip-text text-transparent"
      >
        {HERO_WORDS[i]}?
      </span>
    </span>
  );
}

function HeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  // El panel arranca un poco tumbado y se endereza según bajas.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const t = Math.min(1, window.scrollY / 420);
      if (tiltRef.current) {
        tiltRef.current.style.transform = `perspective(1400px) rotateX(${(1 - t) * 14}deg) scale(${0.94 + t * 0.06})`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (tiltRef.current) tiltRef.current.style.transform = "none";
    } else {
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width - 0.5) * 2}`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height - 0.5) * 2}`);
  };
  const onPointerLeave = () => {
    stageRef.current?.style.setProperty("--mx", "0");
    stageRef.current?.style.setProperty("--my", "0");
  };

  return (
    <div
      ref={stageRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative max-w-5xl mx-auto mt-14 sm:mt-20 animate-fade-up delay-400"
    >
      <div className="absolute -inset-x-10 -inset-y-10 bg-[var(--glow)] blur-[90px] rounded-full pointer-events-none" />

      <div
        ref={tiltRef}
        className="relative mx-auto max-w-xl origin-top will-change-transform"
        style={{ transform: "perspective(1400px) rotateX(14deg) scale(0.94)" }}
      >
        <div className="landing-parallax" style={{ "--depth": 6 } as React.CSSProperties}>
          <AppWindow path="/groups/los-del-jueves?tab=ranking">
            <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-[var(--text)] font-[family-name:var(--font-display)] truncate">Los del jueves 🎲</div>
                <div className="text-[11px] text-[var(--text-muted)]">5 jugadores · 212 juegos en la mesa</div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                Votando ahora
              </span>
            </div>
            <div className="pb-3 pt-1">
              <LiveRanking />
            </div>
          </AppWindow>
        </div>
      </div>

      {/* Tarjetas flotantes alrededor, solo con sitio */}
      <div className="hidden lg:block absolute left-0 top-40 -rotate-6">
        <div className="landing-parallax" style={{ "--depth": 22 } as React.CSSProperties}>
          <div className="animate-float-slow">
            <EventTicketMini />
          </div>
        </div>
      </div>
      <div className="hidden lg:block absolute right-2 top-6 rotate-6">
        <div className="landing-parallax" style={{ "--depth": -18 } as React.CSSProperties}>
          <div className="animate-float">
            <WinnerMini />
          </div>
        </div>
      </div>
      <div className="hidden lg:block absolute -right-4 bottom-4 rotate-2">
        <div className="landing-parallax" style={{ "--depth": 30 } as React.CSSProperties}>
          <div className="animate-float-slow delay-700">
            <ToastMini />
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ loginHref }: { loginHref: string }) {
  return (
    <section className="relative px-4 pt-10 sm:pt-20 pb-16 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 fx-dots opacity-70 pointer-events-none" aria-hidden />

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="animate-fade-up">
          <Link
            href="/changelog"
            className="group inline-flex items-center gap-2 pl-1.5 pr-3 py-1 text-xs font-medium rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 transition-colors mb-7 shadow-[var(--card-shadow)]"
          >
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-text)] font-bold">Nuevo</span>
            <span className="sm:hidden">Colección, perfiles e insignias</span>
            <span className="hidden sm:inline">Tu colección en estantería, perfiles e insignias</span>
            <Arrow className="w-3.5 h-3.5" />
          </Link>
        </div>

        <h1 className="text-[2.6rem] leading-[1.05] sm:text-7xl font-extrabold tracking-tight mb-6 animate-fade-up delay-100">
          ¿A qué jugamos
          <RotatingWord />
        </h1>

        <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up delay-200">
          Juntad vuestras colecciones de BoardGameGeek, votad lo que os apetece y dejad que el ranking decida la próxima
          partida. Y de paso, pon orden en tu ludoteca y encuentra eventos donde apuntar qué quieres jugar.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up delay-300">
          <PrimaryCta href={loginHref}>Empieza gratis</PrimaryCta>
          <a
            href="#grupos"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-[var(--text)] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 transition-colors"
          >
            Ver cómo funciona
            <span className="animate-bounce">↓</span>
          </a>
        </div>
        <p className="mt-5 text-sm text-[var(--text-muted)] animate-fade-up delay-400">
          Sin contraseñas · Gratis · Tu colección de BGG en un clic
        </p>
      </div>

      <HeroStage />
    </section>
  );
}

// ── Cinta de cajas ──────────────────────────────────────────────────────

function MarqueeRow({ games, reverse = false, duration }: { games: DemoGame[]; reverse?: boolean; duration: number }) {
  return (
    <div className="landing-marquee overflow-hidden py-2">
      <div
        className={`landing-marquee-track gap-4 ${reverse ? "landing-marquee-track--reverse" : ""}`}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {[...games, ...games].map((g, i) => (
          <div
            key={`${g.bggId}-${i}`}
            className="shrink-0 h-24 sm:h-28 rounded-lg overflow-hidden shadow-[0_8px_16px_-6px_rgba(0,0,0,0.35)] hover:-translate-y-1 hover:rotate-1 transition-transform"
            title={g.name}
            aria-hidden={i >= games.length}
          >
            <Image src={g.thumb} alt={i < games.length ? g.name : ""} width={150} height={112} unoptimized className="h-full w-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BoxMarquee() {
  return (
    <section className="py-10 sm:py-14 border-y border-[var(--border)] bg-[var(--surface-alt)]/50" aria-label="Juegos de BoardGameGeek">
      <Reveal className="text-center px-4 mb-6">
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Tu colección de <strong className="text-[var(--text)]">BoardGameGeek</strong> entra sola: carátulas, jugadores,
          duración, peso y nota.
        </p>
      </Reveal>
      <div className="space-y-3">
        <MarqueeRow games={MARQUEE_TOP} duration={55} />
        <MarqueeRow games={MARQUEE_BOTTOM} duration={65} reverse />
      </div>
    </section>
  );
}

// ── Grupos: la historia con scroll ──────────────────────────────────────

const STORY = [
  {
    emoji: "👥",
    title: "Montad el grupo",
    text: "Crea el grupo, pasa el enlace por WhatsApp y cada uno trae su colección de BGG. En un momento tenéis los juegos de todos en la misma mesa.",
    points: ["Invitación con enlace o por email", "Colecciones de BGG importadas solas", "Modo «con amigos» o «en pareja», con escala más fina para decidir entre dos"],
  },
  {
    emoji: "🗳️",
    title: "Votad sin piedad",
    text: "👍 si te apetece, 👎 si ni loco, y un supervoto ⭐ que vale por tres para tu favorito. Deja un comentario para defender tu elección y mira al momento a qué puesto sube.",
    points: ["Un supervoto por persona y grupo: úsalo bien", "Comentarios con emojis para hacer campaña", "Ves quién tiene aún el supervoto sin gastar"],
  },
  {
    emoji: "🏆",
    title: "Sale el ranking",
    text: "El podio se mueve con cada voto. Pasa por encima de la puntuación y verás quién ha votado qué (sí, el 👎 fue de Dani).",
    points: ["Podio de oro, plata y bronce en la portada del grupo", "Convoca a todos por email cuando toque organizar la siguiente", "¿Temporada nueva? Empezad de cero con el ranking limpio"],
  },
  {
    emoji: "🎲",
    title: "¡A la mesa!",
    text: "Dile cuántos sois y cuánto tiempo tenéis y BG Planner os propone lo mejor del ranking. ¿Seguís sin decidir? «Ayúdame a elegir» lo sortea con ruleta y confeti.",
    points: ["Sesiones con los juegos ordenados y su estado", "Marca lo jugado, puntúalo y sube las fotos a la galería", "El grupo en números: partidas, horas y el más jugado"],
  },
];

function StoryMock({ index, active }: { index: number; active: boolean }) {
  if (index === 0) return <GroupSetupMock active={active} />;
  if (index === 1) return <VoteMock active={active} />;
  if (index === 2) return <PodiumMock active={active} />;
  return <PickMock active={active} />;
}

function GroupsStory() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Cuenta como paso activo el que cruza la franja central de la pantalla.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = Number((entry.target as HTMLElement).dataset.step);
            setActive(i);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="grupos" className="relative px-4 py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-12 lg:mb-4">
          <Kicker>👑 El corazón de BG Planner</Kicker>
          <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Se acabó el «me da igual, elige tú»
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] text-lg">
            Un grupo es vuestra mesa: los juegos de todos en un sitio y un ranking que sale de lo que de verdad os apetece.
          </p>
        </Reveal>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16">
          <div>
            {STORY.map((step, i) => (
              <div
                key={step.title}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                data-step={i}
                className="py-10 lg:py-0 lg:min-h-[80vh] flex flex-col justify-center"
              >
                <div
                  className={`transition-all duration-500 ${
                    active === i ? "lg:opacity-100" : "lg:opacity-35"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${
                        active === i ? "bg-[var(--primary)] shadow-lg shadow-[var(--glow)] scale-105" : "bg-[var(--surface-alt)]"
                      }`}
                    >
                      {step.emoji}
                    </span>
                    <span className="text-sm font-mono font-semibold text-[var(--text-muted)]">0{i + 1} / 04</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{step.title}</h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed mb-5 max-w-lg">{step.text}</p>
                  <ul className="space-y-2">
                    {step.points.map((p) => (
                      <Check key={p}>{p}</Check>
                    ))}
                  </ul>
                </div>
                {/* En móvil, el mockup va debajo de cada paso */}
                <div className="lg:hidden mt-8">
                  <StoryMock index={i} active={active === i} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-[12vh] h-[76vh] flex flex-col justify-center">
              <div className="flex gap-1.5 mb-5 px-1">
                {STORY.map((s, i) => (
                  <div key={s.title} className="flex-1 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] transition-transform duration-500 origin-left"
                      style={{ transform: `scaleX(${i <= active ? 1 : 0})` }}
                    />
                  </div>
                ))}
              </div>
              <div className="relative h-[480px]">
                {STORY.map((s, i) => (
                  <div
                    key={s.title}
                    className="absolute inset-x-0 top-0 transition-all duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                    style={{
                      opacity: active === i ? 1 : 0,
                      transform:
                        active === i
                          ? "translateY(0) scale(1) rotate(0deg)"
                          : i < active
                            ? "translateY(-40px) scale(0.94) rotate(-2deg)"
                            : "translateY(40px) scale(0.94) rotate(2deg)",
                      pointerEvents: active === i ? "auto" : "none",
                    }}
                    aria-hidden={active !== i}
                  >
                    <StoryMock index={i} active={active === i} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Colección ───────────────────────────────────────────────────────────

const COLLECTION_POINTS = [
  { icon: "🪵", title: "Vista de estantería", text: "Tus cajas en baldas de madera, como en casa (pero sin polvo)." },
  { icon: "💎", title: "¿Se queda o se va?", text: "Puntúa cada juego del 💸 «Quiero venderlo» al 💎 «No se irá nunca». Solo lo ves tú." },
  { icon: "⭐", title: "Tu vitrina", text: "Marca tus imprescindibles y se exponen solos en tu perfil público." },
  { icon: "🔗", title: "Compártela", text: "Un enlace de solo lectura para que te cotilleen la colección… o te la envidien." },
];

function CollectionSection() {
  return (
    <section id="coleccion" className="relative px-4 py-20 sm:py-28 scroll-mt-16 overflow-hidden">
      <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-[var(--glow)] rounded-full blur-[120px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
        <div>
          <Reveal>
            <Kicker>📚 Mi colección</Kicker>
            <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Tu ludoteca,
              <br />
              por fin en orden
            </h2>
            <p className="mt-4 text-lg text-[var(--text-secondary)] leading-relaxed">
              Todos tus juegos y tu wishlist de BGG en un sitio, con tus partidas, tu nota y su puesto en BGG a la vista. Y
              la pregunta que nadie se atreve a hacerse: ¿de verdad te lo vas a quedar?
            </p>
          </Reveal>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {COLLECTION_POINTS.map((p, i) => (
              <Reveal key={p.title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--primary)]/30 hover:-translate-y-0.5 transition-all">
                  <div className="text-2xl mb-2">{p.icon}</div>
                  <div className="font-bold text-[var(--text)] mb-1">{p.title}</div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal variant="right" className="relative">
          <span className="absolute -top-4 right-6 z-10 rotate-3 text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-text)] shadow-lg animate-float">
            ¡Pruébalo! Es de verdad 👆
          </span>
          <CollectionMock />
        </Reveal>
      </div>
    </section>
  );
}

// ── Eventos ─────────────────────────────────────────────────────────────

function EventsSection({ events, loginHref }: { events: LandingEvent[]; loginHref: string }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <section id="eventos" className="relative px-4 py-20 sm:py-28 scroll-mt-16 bg-[var(--surface-alt)]/50 border-y border-[var(--border)] overflow-hidden">
      <div className="absolute -top-20 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <Reveal variant="left" className="order-2 lg:order-1">
            <div ref={setRef} className="max-w-md mx-auto lg:max-w-none">
              <EventMock active={inView} />
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <Kicker>🎪 Eventos</Kicker>
              <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Jornadas y quedadas, pero con plan
              </h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)] leading-relaxed">
                Encuentra eventos abiertos, apúntate con un clic y marca qué juegos quieres jugar allí, del 1 «Solo si no
                queda otra» al 5 «Máxima prioridad». Llegas sabiendo con quién compartirás mesa… y quien organiza sabe qué
                mesas montar.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <ul className="mt-6 space-y-2.5">
                <Check>Eventos abiertos o privados, con cartel, lugar y plazas</Check>
                <Check>Tu lista de prioridades, con notas que solo ves tú</Check>
                <Check>Mira qué quiere jugar el resto de asistentes</Check>
                <Check>Después, galería de fotos y valoraciones del evento</Check>
              </ul>
            </Reveal>
          </div>
        </div>

        {events.length > 0 && (
          <div className="mt-20">
            <Reveal className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Próximamente en BG Planner</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Eventos abiertos a los que te puedes apuntar ya</p>
              </div>
              <Link href="/events" className="shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline">
                Ver todos →
              </Link>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev, i) => (
                <Reveal key={ev.id} delay={i * 100}>
                  <Link
                    href={`/events/${ev.id}`}
                    className="group block h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--primary)]/40 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative h-28 fx-event-art overflow-hidden">
                      {ev.imageUrl && (
                        <Image
                          src={ev.imageUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="400px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      <div className="absolute top-2.5 right-2.5 w-12 rounded-lg bg-white text-center overflow-hidden shadow">
                        <div className="bg-rose-500 text-white text-[9px] font-bold py-0.5 uppercase">{ev.weekday}</div>
                        <div className="text-lg font-extrabold text-slate-900 leading-tight">{ev.day}</div>
                        <div className="text-[9px] font-semibold text-slate-500 pb-0.5 uppercase">{ev.month}</div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="font-bold text-[var(--text)] leading-tight line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
                        {ev.name}
                      </div>
                      <div className="mt-1.5 text-xs text-[var(--text-muted)] space-y-0.5">
                        <div>🕐 {ev.time}{ev.location ? ` · 📍 ${ev.location}` : ""}</div>
                        <div>
                          👥 {ev.attendeeCount} {ev.attendeeCount === 1 ? "apuntado" : "apuntados"}
                          {ev.gameCount > 0 ? ` · 🎲 ${ev.gameCount} ${ev.gameCount === 1 ? "juego" : "juegos"}` : ""}
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <Reveal className="mt-14 text-center">
            <p className="text-[var(--text-secondary)]">
              ¿Organizas unas jornadas?{" "}
              <Link href={loginHref} className="font-semibold text-[var(--primary)] hover:underline">
                Crea el evento y compártelo
              </Link>
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// ── Y además ────────────────────────────────────────────────────────────

const EXTRAS: { title: string; text: string; mini: ReactNode }[] = [
  { title: "Perfil e insignias", text: "Tu ficha de jugador con vitrina, eventos e insignias de bronce, plata y oro para cada cosa que haces.", mini: <BadgesMini /> },
  { title: "Galería y opiniones", text: "Puntúa cada partida con estrellas, cuenta qué tal fue y sube las fotos para el recuerdo.", mini: <GalleryMini /> },
  { title: "Convoca al grupo", text: "Un botón y a todos les llega un email para votar la próxima partida.", mini: <PingMini /> },
  { title: "Modo pareja", text: "Del −1 al +5 para decidir entre dos con más matiz que un simple sí o no.", mini: <CoupleMini /> },
  { title: "Enlaces que lucen", text: "Comparte tu perfil, tu colección o un evento y en WhatsApp sale una tarjeta en condiciones.", mini: <ShareMini /> },
  { title: "Vosotros decidís", text: "Propón ideas y vota las del resto: lo más votado es lo siguiente que hacemos.", mini: <RoadmapMini /> },
];

function SpotlightCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className="group relative h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 overflow-hidden hover:border-[var(--primary)]/30 hover:-translate-y-1 transition-all duration-300"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "radial-gradient(320px circle at var(--sx) var(--sy), var(--glow), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function ExtrasSection() {
  return (
    <section id="mas" className="px-4 py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <Kicker>✨ Y además</Kicker>
          <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">Un montón de detalles más</h2>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">Pequeñas cosas que hacen que organizar sea casi tan divertido como jugar.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXTRAS.map((x, i) => (
            <Reveal key={x.title} variant="scale" delay={(i % 3) * 90}>
              <SpotlightCard>
                <div className="h-[92px] flex items-center">
                  <div className="w-full">{x.mini}</div>
                </div>
                <h3 className="mt-4 font-bold text-lg text-[var(--text)]">{x.title}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">{x.text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Cómo empezar ────────────────────────────────────────────────────────

const STEPS = [
  { num: "1", title: "Entra con tu email", text: "Sin contraseñas: te mandamos un código de 6 dígitos y listo." },
  { num: "2", title: "Conecta tu BGG", text: "Pon tu usuario de BoardGameGeek y tu colección aparece sola." },
  { num: "3", title: "Crea tu grupo", text: "O apúntate a un evento. Invita a los tuyos y… ¡a votar!" },
];

function StepsSection() {
  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Empezar lleva un minuto</h2>
        </Reveal>
        <div className="relative grid sm:grid-cols-3 gap-8 sm:gap-6">
          <div className="hidden sm:block absolute top-7 left-[16%] right-[16%] h-px border-t-2 border-dashed border-[var(--border-strong)]" aria-hidden />
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 150} className="relative text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center text-xl font-extrabold shadow-lg shadow-[var(--glow)] rotate-3 hover:rotate-0 transition-transform">
                {s.num}
              </div>
              <h3 className="mt-4 font-bold text-lg">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-[240px] mx-auto">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Llamada final ───────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function RollingDie() {
  const [face, setFace] = useState(6);
  const [roll, setRoll] = useState(0);
  const doRoll = () => {
    setRoll((r) => r + 1);
    setFace((f) => {
      let n = f;
      while (n === f) n = 1 + Math.floor(Math.random() * 6);
      return n;
    });
  };
  return (
    <button
      onClick={doRoll}
      onMouseEnter={doRoll}
      className="mx-auto mb-6 block w-16 h-16 focus-visible:outline-2 focus-visible:outline-[var(--primary)] rounded-2xl"
      aria-label="Tirar el dado"
      title="¡Tira el dado!"
    >
      <svg key={roll} viewBox="0 0 100 100" className={`w-16 h-16 drop-shadow-lg ${roll ? "landing-die-roll" : ""}`}>
        <rect x="6" y="6" width="88" height="88" rx="20" fill="var(--primary)" />
        <rect x="6" y="6" width="88" height="88" rx="20" fill="url(#die-shine)" />
        <defs>
          <linearGradient id="die-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {PIPS[face].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="8" fill="var(--primary-text)" />
        ))}
      </svg>
    </button>
  );
}

function FinalCta({ loginHref }: { loginHref: string }) {
  const floating = [DEMO_GAMES.brass, DEMO_GAMES.wyrmspan, DEMO_GAMES.root, DEMO_GAMES.odin];
  const spots = [
    "top-6 left-6 -rotate-12",
    "bottom-8 left-12 rotate-6",
    "top-10 right-8 rotate-12",
    "bottom-6 right-14 -rotate-6",
  ];
  return (
    <section className="px-4 py-16 sm:py-24">
      <Reveal variant="scale" className="max-w-4xl mx-auto">
        <div className="relative rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] px-6 py-14 sm:p-16 overflow-hidden text-center">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--glow)] rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--glow)] rounded-full blur-[80px]" />
          <div className="absolute inset-0 fx-dots opacity-50" aria-hidden />

          {floating.map((g, i) => (
            <div key={g.bggId} className={`hidden md:block absolute ${spots[i]} opacity-80`} aria-hidden>
              <div className={i % 2 ? "animate-float" : "animate-float-slow"}>
                <Image src={g.thumb} alt="" width={90} height={70} unoptimized className="h-16 w-auto rounded-md shadow-xl" />
              </div>
            </div>
          ))}

          <div className="relative">
            <RollingDie />
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              La próxima partida
              <br />
              empieza aquí
            </h2>
            <p className="mt-4 mb-9 text-lg text-[var(--text-secondary)] max-w-md mx-auto">
              Crea tu cuenta en medio minuto. Tus amigos te lo agradecerán, y ese Brass que coge polvo, también.
            </p>
            <PrimaryCta href={loginHref}>Crear cuenta gratis</PrimaryCta>
            <p className="mt-4 text-xs text-[var(--text-muted)]">Sin contraseñas · Sin tarjetas · Sin letra pequeña</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── Página ──────────────────────────────────────────────────────────────

export default function Landing({ events, loginHref }: { events: LandingEvent[]; loginHref: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <ScrollProgress />
      <Nav loginHref={loginHref} />
      <main>
        <Hero loginHref={loginHref} />
        <BoxMarquee />
        <GroupsStory />
        <CollectionSection />
        <EventsSection events={events} loginHref={loginHref} />
        <ExtrasSection />
        <StepsSection />
        <FinalCta loginHref={loginHref} />
      </main>
      <Footer />
    </div>
  );
}
