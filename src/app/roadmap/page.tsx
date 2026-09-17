"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import EmojiField from "@/components/EmojiField";
import Footer from "@/components/Footer";
import SmartNav from "@/components/SmartNav";
import { resizeImage } from "@/lib/image";
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
  const [voting, setVoting] = useState("");

  // Formulario de propuesta: cerrado hasta que se pulsa el botón.
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

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
      .catch(() => setError("No se pudo cargar la lista"))
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

  const handleImageUpload = async (files: FileList) => {
    const remaining = 5 - images.length;
    const toProcess = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);
    if (toProcess.length === 0) return;

    setUploadingImage(true);
    try {
      const resized = await Promise.all(toProcess.map((f) => resizeImage(f, 600)));
      setImages((prev) => [...prev, ...resized]);
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFormError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, images: images.length > 0 ? images : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo enviar");

      // Se publica al momento: la pintamos arriba de su sección sin recargar.
      if (data.feature) setFeatures((prev) => [data.feature, ...prev]);
      setSubject("");
      setMessage("");
      setImages([]);
      setFormOpen(false);
      showToast("¡Publicada! Ya puede votarla cualquiera");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  const toggleVote = async (feature: Feature) => {
    if (!isLoggedIn) return;
    setVoting(feature.id);
    const wasVoted = feature.hasVoted;

    // Optimista: el contador se mueve al instante y se corrige con la respuesta.
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === feature.id ? { ...f, hasVoted: !wasVoted, votes: f.votes + (wasVoted ? -1 : 1) } : f
      )
    );

    try {
      const res = await fetch(`/api/features/${feature.id}/vote`, {
        method: wasVoted ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el voto");
      setFeatures((prev) =>
        prev.map((f) => (f.id === feature.id ? { ...f, votes: data.votes, hasVoted: data.hasVoted } : f))
      );
    } catch (e) {
      setFeatures((prev) =>
        prev.map((f) => (f.id === feature.id ? { ...f, hasVoted: wasVoted, votes: feature.votes } : f))
      );
      showToast(e instanceof Error ? e.message : "No se pudo registrar el voto");
    } finally {
      setVoting("");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SmartNav />

      <main className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Ideas y mejoras</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          ¿Echas algo en falta? ¿Te has encontrado un error? Cuéntanoslo y se publica aquí mismo para que
          los demás lo voten: cuantos más votos tenga una idea, antes nos ponemos con ella.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {formOpen ? "Cerrar" : "Proponer una idea"}
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Entra para proponer y votar
            </Link>
          )}
          {isLoggedIn && myVotes > 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              Has votado {myVotes} propuesta{myVotes === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {formOpen && isLoggedIn && (
          <form
            onSubmit={submit}
            className="space-y-5 mb-10 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--card-shadow)]"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                ¿Qué propones?
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
                className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
                placeholder="En una frase: poder apuntar invitados sin cuenta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Cuéntalo</label>
              <EmojiField
                value={message}
                onChange={setMessage}
                required
                maxLength={5000}
                rows={5}
                className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200 resize-none"
                placeholder="Explica para qué te serviría, o qué error te has encontrado y cómo llegaste a él."
              />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                Lo que escribas se publica tal cual en esta lista, con tu nombre visible solo para nosotros.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Capturas <span className="text-[var(--text-muted)] font-normal">(opcional, máx. 5)</span>
              </label>

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] shrink-0"
                    >
                      <Image
                        src={img}
                        alt={`Captura ${i + 1}`}
                        width={80}
                        height={80}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < 5 && (
                <label className="inline-block px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--surface)] transition-all duration-200 cursor-pointer">
                  {uploadingImage ? "Procesando..." : "Adjuntar imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleImageUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {formError && <p className="text-red-400 text-sm">{formError}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                {sending ? "Publicando..." : "Publicar propuesta"}
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-[var(--text-muted)]">Cargando propuestas…</p>}

        {!loading && !error && sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-[var(--text-secondary)] mb-1">Todavía no hay nada en la lista.</p>
            <p className="text-sm text-[var(--text-muted)]">Sé el primero en proponer algo.</p>
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
