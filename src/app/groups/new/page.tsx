"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
            Crear nuevo grupo
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Elige cómo vais a votar: el modo no se puede cambiar después.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Mode selector ── */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-3">
                Tipo de grupo
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {GROUP_TYPE_IDS.map((id) => {
                  const cfg = GROUP_TYPES[id];
                  const selected = type === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setType(id)}
                      className={`text-left rounded-2xl border p-4 transition-all duration-200 shadow-[var(--card-shadow)] ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--accent-soft)] ring-2 ring-[var(--primary)]/30"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40"
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-2xl shrink-0">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[var(--text)]">{cfg.label}</div>
                          <div className="text-xs text-[var(--text-secondary)]">{cfg.tagline}</div>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{cfg.description}</p>
                      <ul className="text-xs text-[var(--text-muted)] space-y-1 mb-3">
                        {cfg.recommendedFor.map((r, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-[var(--primary)]">·</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[var(--border)]">
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
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Name ── */}
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)] space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Nombre del grupo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === "couple" ? "Ej: Noches en pareja" : "Ej: Noches de juegos"}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {loading ? "Creando..." : "Crear grupo"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
}
