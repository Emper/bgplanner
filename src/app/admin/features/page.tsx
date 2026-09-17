"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FEATURE_STATUSES, featureStatusAccent, featureStatusLabel } from "@/lib/features";

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  votes: number;
  feedbacks: number;
  voters: { id: string; name: string; avatarUrl: string | null }[];
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [editing, setEditing] = useState<AdminFeature | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("proposed");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminFeature | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/features")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setFeatures)
      .catch(() => setError("No se pudo cargar el roadmap"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("proposed");
    setModalError("");
  };

  const openEdit = (f: AdminFeature) => {
    setEditing(f);
    setCreating(false);
    setTitle(f.title);
    setDescription(f.description);
    setStatus(f.status);
    setModalError("");
  };

  const closeModal = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    setSaving(true);
    setModalError("");
    try {
      const res = await fetch(
        editing ? `/api/admin/features/${editing.id}` : "/api/admin/features",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, status }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      showToast(editing ? "Propuesta actualizada" : "Propuesta creada");
      closeModal();
      load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  // Cambio rápido de estado desde la propia tarjeta, sin abrir el modal.
  const changeStatus = async (feature: AdminFeature, next: string) => {
    const previous = features;
    setFeatures((prev) => prev.map((f) => (f.id === feature.id ? { ...f, status: next } : f)));
    const res = await fetch(`/api/admin/features/${feature.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      showToast(`Ahora es «${featureStatusLabel(next)}»`);
    } else {
      setFeatures(previous);
      showToast("No se pudo cambiar el estado");
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/admin/features/${confirmDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Propuesta eliminada");
      setConfirmDelete(null);
      load();
    } else {
      showToast("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Roadmap</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Las propuestas que ven los usuarios en{" "}
            <Link href="/roadmap" prefetch={false} className="hover:underline text-purple-600 dark:text-purple-300">
              /roadmap
            </Link>
            , ordenadas por votos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/feedback"
            prefetch={false}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Ver feedback
          </Link>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            Nueva propuesta
          </button>
        </div>
      </header>

      {error && <div className="text-sm text-red-500">{error}</div>}
      {loading && <div className="text-sm text-[var(--text-muted)]">Cargando roadmap…</div>}

      {!loading && features.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
          Aún no hay propuestas. Acepta algún feedback o crea una a mano.
        </div>
      )}

      <div className="space-y-3">
        {features.map((f) => (
          <article key={f.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-14 text-center rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] py-2">
                <div className="text-lg font-display font-semibold">{f.votes}</div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  voto{f.votes === 1 ? "" : "s"}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display font-semibold">{f.title}</h2>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                    style={{ color: featureStatusAccent(f.status), borderColor: featureStatusAccent(f.status) }}
                  >
                    {featureStatusLabel(f.status)}
                  </span>
                  {f.feedbacks > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      · {f.feedbacks} feedback{f.feedbacks === 1 ? "" : "s"} detrás
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-1">{f.description}</p>

                {f.voters.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <div className="flex -space-x-2">
                      {f.voters.slice(0, 8).map((v) =>
                        v.avatarUrl ? (
                          <Image
                            key={v.id}
                            src={v.avatarUrl}
                            alt={v.name}
                            title={v.name}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full object-cover border border-[var(--surface)]"
                          />
                        ) : (
                          <span
                            key={v.id}
                            title={v.name}
                            className="w-6 h-6 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center text-[10px] font-semibold border border-[var(--surface)]"
                          >
                            {v.name.charAt(0).toUpperCase()}
                          </span>
                        )
                      )}
                    </div>
                    {f.votes > f.voters.length && (
                      <span className="text-xs text-[var(--text-muted)]">y {f.votes - f.voters.length} más</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <select
                    value={f.status}
                    onChange={(e) => changeStatus(f, e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs bg-[var(--input-bg)] border border-[var(--input-border)]"
                  >
                    {FEATURE_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => openEdit(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-purple-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {(editing || creating) && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && closeModal()}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-semibold mb-4">
              {editing ? "Editar propuesta" : "Nueva propuesta"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm"
                  placeholder="Poder apuntar invitados que no tienen cuenta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm resize-none"
                  placeholder="Explícalo como se lo contarías a un jugador, sin tecnicismos."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Estado</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm"
                >
                  {FEATURE_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.hint}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {modalError && <p className="text-sm text-red-500 mt-3">{modalError}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !title.trim() || !description.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-semibold mb-2">Eliminar propuesta</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Se borrará «{confirmDelete.title}» y sus {confirmDelete.votes} voto
              {confirmDelete.votes === 1 ? "" : "s"}. El feedback original no se toca.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]"
              >
                Cancelar
              </button>
              <button
                onClick={remove}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] shadow-lg rounded-xl px-4 py-2.5 text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
