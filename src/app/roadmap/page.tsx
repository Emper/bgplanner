"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";
import { PUBLIC_FEATURE_STATUSES, isVotableStatus } from "@/lib/features";

interface Feature {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  votes: number;
  hasVoted: boolean;
}

export default function RoadmapPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [voting, setVoting] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }, []);

  useEffect(() => {
    fetch("/api/features")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setFeatures(data.features);
        setIsLoggedIn(data.isLoggedIn);
      })
      .catch(() => setError("No se pudo cargar el roadmap"))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(
    () =>
      PUBLIC_FEATURE_STATUSES.map((s) => ({
        ...s,
        items: features.filter((f) => f.status === s.id),
      })).filter((s) => s.items.length > 0),
    [features]
  );

  const myVotes = features.filter((f) => f.hasVoted).length;

  const toggleVote = async (feature: Feature) => {
    if (!isLoggedIn) return;
    setVoting(feature.id);
    const wasVoted = feature.hasVoted;

    // Optimista: el contador se mueve al instante y se corrige con la respuesta.
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === feature.id
          ? { ...f, hasVoted: !wasVoted, votes: f.votes + (wasVoted ? -1 : 1) }
          : f
      )
    );

    try {
      const res = await fetch(`/api/features/${feature.id}/vote`, {
        method: wasVoted ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el voto");
      }
      const data = await res.json();
      setFeatures((prev) =>
        prev.map((f) => (f.id === feature.id ? { ...f, votes: data.votes, hasVoted: data.hasVoted } : f))
      );
    } catch (e) {
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === feature.id ? { ...f, hasVoted: wasVoted, votes: feature.votes } : f
        )
      );
      showToast(e instanceof Error ? e.message : "No se pudo registrar el voto");
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Próximas funcionalidades</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Esto es lo que tenemos sobre la mesa. Vota las que más te interesen: cuantos más votos
          tenga una idea, antes nos ponemos con ella.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link
            href="/feedback"
            className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Proponer una idea
          </Link>
          {isLoggedIn && myVotes > 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              Has votado {myVotes} propuesta{myVotes === 1 ? "" : "s"}
            </span>
          )}
          {!isLoggedIn && !loading && (
            <span className="text-sm text-[var(--text-muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                Entra
              </Link>{" "}
              para votar.
            </span>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-[var(--text-muted)]">Cargando propuestas…</p>}

        {!loading && !error && sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-[var(--text-secondary)] mb-1">Todavía no hay nada en la lista.</p>
            <p className="text-sm text-[var(--text-muted)]">
              Sé el primero en{" "}
              <Link href="/feedback" className="text-[var(--primary)] hover:underline">
                proponer una idea
              </Link>
              .
            </p>
          </div>
        )}

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id}>
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-lg font-semibold" style={{ color: section.accent }}>
                  {section.label}
                </h2>
                <span className="text-xs text-[var(--text-muted)]">{section.hint}</span>
              </div>
              <ul className="space-y-3 mt-4">
                {section.items.map((f) => {
                  const votable = isVotableStatus(f.status);
                  return (
                    <li
                      key={f.id}
                      className="flex items-start gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--card-shadow)]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleVote(f)}
                        disabled={!votable || !isLoggedIn || voting === f.id}
                        title={
                          !isLoggedIn
                            ? "Entra en tu cuenta para votar"
                            : !votable
                              ? "Esta propuesta ya no admite votos"
                              : f.hasVoted
                                ? "Quitar mi voto"
                                : "Me interesa"
                        }
                        className={`shrink-0 w-14 rounded-xl border flex flex-col items-center justify-center py-2 transition-all duration-200 ${
                          f.hasVoted
                            ? "bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]"
                            : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)]"
                        } ${votable && isLoggedIn ? "hover:border-[var(--primary)] cursor-pointer" : "cursor-default opacity-90"}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                        <span className="text-sm font-semibold mt-0.5">{f.votes}</span>
                      </button>

                      <div className="min-w-0">
                        <h3 className="font-semibold">{f.title}</h3>
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-1">
                          {f.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] shadow-lg rounded-xl px-4 py-2.5 text-sm z-50">
          {toast}
        </div>
      )}

      <Footer />
    </div>
  );
}
