"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import EmojiField from "@/components/EmojiField";
import SmartNav from "@/components/SmartNav";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button, { ButtonLink, buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, FieldError, Input, LABEL_CLASS, fieldClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { loginHref } from "@/lib/site";
import { plural } from "@/lib/text";
import { resizeImage } from "@/lib/image";
import { PUBLIC_FEATURE_STATUSES, isVotableStatus } from "@/lib/features";
import type { RoadmapFeature as Feature } from "@/lib/roadmap";

export default function RoadmapClient({
  initialFeatures,
  isLoggedIn,
}: {
  initialFeatures: Feature[];
  isLoggedIn: boolean;
}) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures);
  const toast = useToast();
  const [voting, setVoting] = useState("");

  // Formulario de propuesta: cerrado hasta que se pulsa el botón.
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

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
      toast.success("¡Publicada! Ya puede votarla cualquiera");
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
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el voto");
    } finally {
      setVoting("");
    }
  };

  return (
    <PageShell nav={<SmartNav />} width="text">
      <PageHeader
        title="Ideas y mejoras"
        lead="¿Echas algo en falta? ¿Te has encontrado un error? Cuéntanoslo y se publica aquí mismo para que los demás lo voten: cuantos más votos tenga una idea, antes nos ponemos con ella."
      />

      <div className="flex flex-wrap items-center gap-3 mb-8">
        {isLoggedIn ? (
          <Button onClick={() => setFormOpen((v) => !v)} aria-expanded={formOpen} className="px-5 py-2.5">
            {formOpen ? "Cerrar" : "Proponer una idea"}
          </Button>
        ) : (
          <ButtonLink href={loginHref("/roadmap")} className="px-5 py-2.5">
            Entra para proponer y votar
          </ButtonLink>
        )}
        {isLoggedIn && myVotes > 0 && (
          <span className="text-sm text-[var(--text-muted)]">
            Has votado {plural(myVotes, "propuesta", "propuestas")}
          </span>
        )}
      </div>

      {formOpen && isLoggedIn && (
        <form onSubmit={submit} className={cardClass({ padding: "none", className: "space-y-5 mb-10 p-5" })}>
          <Field label="¿Qué propones?">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
                placeholder="En una frase: poder apuntar invitados sin cuenta"
              />
            )}
          </Field>

          <Field
            label="Cuéntalo"
            hint="Lo que escribas se publica tal cual en esta lista, con tu nombre visible solo para nosotros."
          >
            {(id) => (
              <EmojiField
                id={id}
                value={message}
                onChange={setMessage}
                required
                maxLength={5000}
                rows={5}
                className={fieldClass({ className: "resize-none" })}
                placeholder="Explica para qué te serviría, o qué error te has encontrado y cómo llegaste a él."
              />
            )}
          </Field>

          <div>
            <p className={LABEL_CLASS}>
              Capturas <span className="text-[var(--text-muted)] font-normal">(opcional, máx. 5)</span>
            </p>

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
                      aria-label={`Quitar captura ${i + 1}`}
                      title="Quitar"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < 5 && (
              <label className={buttonClass({ variant: "secondary", className: "cursor-pointer" })}>
                {uploadingImage ? "Procesando…" : "Adjuntar imagen"}
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

          <FieldError>{formError}</FieldError>

          <div className="flex justify-end">
            <Button type="submit" loading={sending} className="px-6 py-2.5">
              {sending ? "Publicando…" : "Publicar propuesta"}
            </Button>
          </div>
        </form>
      )}

      {sections.length === 0 && (
        <EmptyState
          variant="dashed"
          title="Todavía no hay nada en la lista"
          description="Sé el primero en proponer algo."
        />
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
                    className={cardClass({ padding: "none", className: "flex items-start gap-3 p-4" })}
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
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
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
    </PageShell>
  );
}
