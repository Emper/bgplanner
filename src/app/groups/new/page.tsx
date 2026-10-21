"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import EmojiField from "@/components/EmojiField";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button, { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, FieldError, LABEL_CLASS, fieldClass } from "@/components/ui/Field";
import { GROUP_TYPES, GROUP_TYPE_IDS, type GroupTypeId } from "@/lib/groupTypes";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupTypeId>("friends");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, type }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el grupo");
      }

      const data = await res.json();
      router.push(`/groups/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell nav={<Navbar />} width="form">
      <PageHeader
        title="Crear nuevo grupo"
        lead="Elige cómo vais a votar: el modo no se puede cambiar después."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Mode selector ── */}
        <div>
          <p id="group-type-label" className={LABEL_CLASS}>
            Tipo de grupo
          </p>
          <div role="group" aria-labelledby="group-type-label" className="grid sm:grid-cols-2 gap-3 mt-3">
            {GROUP_TYPE_IDS.map((id) => {
              const cfg = GROUP_TYPES[id];
              const selected = type === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(id)}
                  className={`text-left rounded-2xl border p-5 transition-all duration-200 shadow-[var(--card-shadow)] flex flex-col ${
                    selected
                      ? "border-[var(--primary)] bg-[var(--accent-soft)] ring-2 ring-[var(--primary)]/30"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl leading-none shrink-0" aria-hidden>{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-semibold text-[var(--text)] leading-tight">{cfg.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{cfg.tagline}</div>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{cfg.description}</p>
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Recomendado para
                    </div>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                      {cfg.recommendedFor.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[var(--primary)] shrink-0 leading-5">·</span>
                          <span className="leading-5">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-auto pt-4 border-t border-[var(--border)]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      Votos disponibles
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cfg.allowedVotes.map((v) => (
                        <span
                          key={v.value}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                          title={v.label}
                        >
                          <span>{v.emoji}</span>
                          <span className="font-mono font-semibold">{v.shortLabel}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Name ── */}
        <Card padding="lg" className="space-y-5">
          <Field label="Nombre del grupo">
            {(fieldId) => (
              <EmojiField
                id={fieldId}
                multiline={false}
                required
                maxLength={100}
                value={name}
                onChange={setName}
                placeholder={type === "couple" ? "Ej: Noches en pareja" : "Ej: Noches de juegos"}
                className={fieldClass({ size: "lg" })}
              />
            )}
          </Field>

          <FieldError>{error}</FieldError>

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <ButtonLink href="/groups" variant="secondary" size="lg" className="py-3">
              Cancelar
            </ButtonLink>
            <Button type="submit" size="lg" loading={loading} className="flex-1 py-3">
              {loading ? "Creando…" : "Crear grupo"}
            </Button>
          </div>
        </Card>
      </form>
    </PageShell>
  );
}
