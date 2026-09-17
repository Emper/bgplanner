"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEATURE_STATUSES, featureStatusAccent, featureStatusLabel } from "@/lib/features";

interface Origin {
  id: string;
  message: string;
  images: string[];
  createdAt: string;
  author: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  votes: number;
  voters: { id: string; name: string; avatarUrl: string | null }[];
  origins: Origin[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminRoadmapPage() {
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");

  const [editing, setEditing] = useState<AdminFeature | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("proposed");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminFeature | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/features")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setFeatures(data);
        setError("");
      })
      .catch(() => setError("No se pudo cargar el roadmap"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: features.length };
    for (const f of features) c[f.status] = (c[f.status] || 0) + 1;
    return c;
  }, [features]);

  const filtered = useMemo(
    () => (filter === "all" ? features : features.filter((f) => f.status === filter)),
    [features, filter]
  );

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      const res = await fetch(editing ? `/api/admin/features/${editing.id}` : "/api/admin/features", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status }),
      });
      const saved = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(saved.error || "No se pudo guardar");

      if (editing) {
        setFeatures((prev) => prev.map((f) => (f.id === saved.id ? { ...f, ...saved } : f)));
        showToast("Propuesta actualizada");
      } else {
        setFeatures((prev) => [{ ...saved, voters: [], origins: [] }, ...prev]);
        showToast("Propuesta creada — ya se ve en el roadmap");
      }
      closeModal();
      load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

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
      setFeatures((prev) => prev.filter((f) => f.id !== confirmDelete.id));
      setConfirmDelete(null);
      showToast("Entrada eliminada");
    } else {
      showToast("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Roadmap e ideas</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Todo lo que propone la gente se publica al momento.{" "}
            <Link
              href="/roadmap"
              prefetch={false}
              target="_blank"
              className="hover:underline text-purple-600 dark:text-purple-300"
            >
              Ver la página pública ↗
            </Link>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
        >
          Nueva propuesta
        </button>
      </header>

      <div className="flex gap-2 flex-wrap">
        {[{ id: "all", label: "Todas" }, ...FEATURE_STATUSES.map((s) => ({ id: s.id, label: s.label }))].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              filter === tab.id
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${filter === tab.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>
              {counts[tab.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
      {loading && <div className="text-sm text-[var(--text-muted)]">Cargando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
          {features.length === 0 ? "Aún no hay propuestas." : "Nada con ese estado."}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((f) => {
          const origin = f.origins[0];
          const isOpen = expanded.has(f.id);
          return (
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
                    <span className="text-[10px] text-[var(--text-muted)]">· {formatDate(f.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-1">{f.description}</p>

                  {origin && (
                    <button
                      onClick={() => toggleExpanded(f.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-purple-600"
                    >
                      {origin.author.avatarUrl ? (
                        <Image
                          src={origin.author.avatarUrl}
                          alt={origin.author.name}
                          width={18}
                          height={18}
                          className="w-[18px] h-[18px] rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-[18px] h-[18px] rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center text-[9px] font-semibold">
                          {origin.author.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      Propuesta de {origin.author.name}
                      {f.origins.length > 1 && ` y ${f.origins.length - 1} más`}
                      {origin.images.length > 0 && ` · ${origin.images.length} captura${origin.images.length === 1 ? "" : "s"}`}
                      <span>{isOpen ? "▴" : "▾"}</span>
                    </button>
                  )}

                  {isOpen &&
                    f.origins.map((o) => (
                      <div
                        key={o.id}
                        className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3"
                      >
                        <div className="text-xs text-[var(--text-muted)] mb-1">
                          {o.author.name} · {o.author.email} · {formatDate(o.createdAt)}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{o.message}</p>
                        {o.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {o.images.map((url) => (
                              <button
                                key={url}
                                onClick={() => setZoomed(url)}
                                className="w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)]"
                              >
                                <Image
                                  src={url}
                                  alt="Captura adjunta"
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

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
          );
        })}
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
            <h2 className="text-lg font-display font-semibold mb-1">
              {editing ? "Editar propuesta" : "Nueva propuesta"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Así es como la ven los usuarios en el roadmap.
            </p>

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
            <h2 className="text-lg font-display font-semibold mb-2">Eliminar del roadmap</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Se borra «{confirmDelete.title}», sus {confirmDelete.votes} voto
              {confirmDelete.votes === 1 ? "" : "s"} y el mensaje original de quien la propuso. Si solo quieres
              sacarla de la lista pública, márcala como «Lista» o «Descartada».
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

      {zoomed && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
        >
          <Image
            src={zoomed}
            alt="Captura adjunta"
            width={1200}
            height={900}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
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
