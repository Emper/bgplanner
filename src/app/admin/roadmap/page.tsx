"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEATURE_STATUSES, featureStatusAccent, featureStatusLabel } from "@/lib/features";
import { formatDateShort } from "@/lib/format";
import { displayName } from "@/lib/users";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Avatar from "@/components/Avatar";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, FieldError, Input, Select, Textarea } from "@/components/ui/Field";
import { InlineLoading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { AdminChip, AdminHeader } from "../AdminUI";

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

export default function AdminRoadmapPage() {
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();
  const [filter, setFilter] = useState("all");

  const [editing, setEditing] = useState<AdminFeature | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("proposed");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminFeature | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEscapeKey(() => setZoomed(null), !!zoomed);

  // Al recargar tras guardar no se vuelve a «Cargando…»: se refresca en el sitio.
  const load = useCallback(() => {
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
        toast("Propuesta actualizada");
      } else {
        setFeatures((prev) => [{ ...saved, voters: [], origins: [] }, ...prev]);
        toast("Propuesta creada — ya se ve en el roadmap");
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
      toast(`Ahora es «${featureStatusLabel(next)}»`);
    } else {
      setFeatures(previous);
      toast.error("No se pudo cambiar el estado");
    }
  };

  const remove = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/features/${confirmDelete.id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (res?.ok) {
      setFeatures((prev) => prev.filter((f) => f.id !== confirmDelete.id));
      setConfirmDelete(null);
      toast("Entrada eliminada");
    } else {
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Roadmap e ideas"
        lead={
          <>
            Todo lo que propone la gente se publica al momento.{" "}
            <Link
              href="/roadmap"
              prefetch={false}
              target="_blank"
              className="hover:underline text-purple-600 dark:text-purple-300"
            >
              Ver la página pública ↗
            </Link>
          </>
        }
        action={<Button onClick={openCreate}>Nueva propuesta</Button>}
      />

      <div className="flex gap-2 flex-wrap">
        {[{ id: "all", label: "Todas" }, ...FEATURE_STATUSES.map((s) => ({ id: s.id, label: s.label }))].map((tab) => (
          <AdminChip key={tab.id} active={filter === tab.id} count={counts[tab.id] ?? 0} onClick={() => setFilter(tab.id)}>
            {tab.label}
          </AdminChip>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && <InlineLoading />}

      {!loading && filtered.length === 0 && (
        <EmptyState variant="dashed" title={features.length === 0 ? "Aún no hay propuestas." : "Nada con ese estado."} />
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
                    <span className="text-[10px] text-[var(--text-muted)]">· {formatDateShort(f.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-1">{f.description}</p>

                  {origin && (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleExpanded(f.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-purple-600"
                    >
                      <Avatar name={displayName(origin.author, origin.author.email)} avatarUrl={origin.author.avatarUrl} size="xs" />
                      Propuesta de {displayName(origin.author, origin.author.email)}
                      {f.origins.length > 1 && ` y ${f.origins.length - 1} más`}
                      {origin.images.length > 0 && ` · ${origin.images.length} captura${origin.images.length === 1 ? "" : "s"}`}
                      <span aria-hidden>{isOpen ? "▴" : "▾"}</span>
                    </button>
                  )}

                  {isOpen &&
                    f.origins.map((o) => (
                      <div
                        key={o.id}
                        className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3"
                      >
                        <div className="text-xs text-[var(--text-muted)] mb-1">
                          {displayName(o.author, o.author.email)} · {o.author.email} · {formatDateShort(o.createdAt)}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{o.message}</p>
                        {o.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {o.images.map((url) => (
                              <button
                                key={url}
                                type="button"
                                aria-label="Ampliar captura"
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
                        {f.voters.slice(0, 8).map((v) => (
                          <span key={v.id} title={v.name} className="rounded-full ring-1 ring-[var(--surface)]">
                            <Avatar name={v.name} avatarUrl={v.avatarUrl} size="xs" />
                          </span>
                        ))}
                      </div>
                      {f.votes > f.voters.length && (
                        <span className="text-xs text-[var(--text-muted)]">y {f.votes - f.voters.length} más</span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div className="w-36">
                      <Select
                        size="sm"
                        aria-label="Estado"
                        value={f.status}
                        onChange={(e) => changeStatus(f, e.target.value)}
                      >
                        {FEATURE_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button variant="secondary" size="xs" onClick={() => openEdit(f)}>
                      Editar
                    </Button>
                    <Button variant="dangerOutline" size="xs" onClick={() => setConfirmDelete(f)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={!!editing || creating}
        onClose={closeModal}
        title={editing ? "Editar propuesta" : "Nueva propuesta"}
        description="Así es como la ven los usuarios en el roadmap."
        size="lg"
        busy={saving}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={!title.trim() || !description.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Título">
            {(fieldId) => (
              <Input
                id={fieldId}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Poder apuntar invitados que no tienen cuenta"
              />
            )}
          </Field>
          <Field label="Descripción">
            {(fieldId) => (
              <Textarea
                id={fieldId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Explícalo como se lo contarías a un jugador, sin tecnicismos."
              />
            )}
          </Field>
          <Field label="Estado">
            {(fieldId) => (
              <Select id={fieldId} value={status} onChange={(e) => setStatus(e.target.value)}>
                {FEATURE_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <FieldError>{modalError}</FieldError>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title="Eliminar del roadmap"
        body={
          confirmDelete && (
            <p>
              Se borra «{confirmDelete.title}», sus {confirmDelete.votes} voto
              {confirmDelete.votes === 1 ? "" : "s"} y el mensaje original de quien la propuso. Si solo quieres
              sacarla de la lista pública, márcala como «Lista» o «Descartada».
            </p>
          )
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />

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
    </div>
  );
}
