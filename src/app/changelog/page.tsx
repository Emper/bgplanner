import type { Metadata } from "next";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";
import { CHANGELOG } from "@/lib/changelog";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Nuevo", color: "bg-emerald-500/20 text-emerald-400" },
  improved: { label: "Mejora", color: "bg-blue-500/20 text-blue-400" },
  fixed: { label: "Fix", color: "bg-[var(--accent-soft)] text-[var(--primary)]" },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Contenido fijo: se genera una vez en el build y se sirve como HTML estático.
export const metadata: Metadata = {
  title: "Novedades · BG Planner",
  description:
    "Todo lo nuevo en BG Planner: cada mejora para organizar partidas de juegos de mesa con tus amigos, versión a versión.",
  alternates: { canonical: `${APP_URL}/changelog` },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="page-text page-pad">
        <h1 className="page-title mb-2">Changelog</h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Historial de cambios y mejoras de BG Planner.
        </p>

        <div className="space-y-10">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="relative">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-[var(--primary)] text-[var(--primary-text)]">
                  v{entry.version}
                </span>
                <h2 className="text-lg font-semibold text-[var(--text)]">{entry.title}</h2>
                <span className="text-xs text-[var(--text-muted)]">{entry.date}</span>
              </div>
              <ul className="space-y-2 ml-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium mt-0.5 ${TYPE_LABELS[change.type].color}`}>
                      {TYPE_LABELS[change.type].label}
                    </span>
                    <span className="text-[var(--text-secondary)]">{change.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
