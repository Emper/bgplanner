"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FEATURE_STATUSES,
  FEEDBACK_STATUSES,
  featureStatusAccent,
  featureStatusLabel,
} from "@/lib/features";

interface AdminFeedback {
  id: string;
  subject: string;
  message: string;
  images: string[];
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  author: { id: string; name: string; email: string; avatarUrl: string | null };
  feature: { id: string; title: string; status: string; votes: number } | null;
}

interface FeatureOption {
  id: string;
  title: string;
  status: string;
  votes: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [features, setFeatures] = useState<FeatureOption[]>([]);
  const [tab, setTab] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modal de triaje: `accept` o `reject` sobre un feedback concreto.
  const [reviewing, setReviewing] = useState<{ item: AdminFeedback; action: "accept" | "reject" } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [featureStatus, setFeatureStatus] = useState("proposed");
  const [linkTo, setLinkTo] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    // El listado de propuestas solo alimenta el desplegable de "vincular a una
    // existente": si falla, la bandeja tiene que verse igual.
    fetch("/api/admin/features")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFeatures)
      .catch(() => setFeatures([]));

    fetch("/api/admin/feedback")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setItems(data.items);
        setCounts(data.counts);
        setError("");
      })
      .catch(() => setError("No se pudo cargar el feedback"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => items.filter((i) => i.status === tab), [items, tab]);

  const openReview = (item: AdminFeedback, action: "accept" | "reject") => {
    setReviewing({ item, action });
    setTitle(item.subject);
    setDescription(item.message.slice(0, 2000));
    setFeatureStatus("proposed");
    setLinkTo("");
    setAdminNote("");
    setNotify(true);
    setModalError("");
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    setModalError("");
    try {
      const payload =
        reviewing.action === "accept"
          ? linkTo
            ? { action: "accept", featureId: linkTo, adminNote: adminNote || undefined, notify }
            : { action: "accept", title, description, status: featureStatus, adminNote: adminNote || undefined, notify }
          : { action: "reject", adminNote: adminNote || undefined, notify };

      const res = await fetch(`/api/admin/feedback/${reviewing.item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      showToast(reviewing.action === "accept" ? "Propuesta publicada en el roadmap" : "Feedback descartado");
      setReviewing(null);
      load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const reopen = async (item: AdminFeedback) => {
    const res = await fetch(`/api/admin/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (res.ok) {
      showToast("Vuelve a pendientes");
      load();
    } else {
      showToast("No se pudo reabrir");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Feedback de usuarios</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Acepta lo que te convenza (se publica en el roadmap para que lo voten) o descártalo.
          </p>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_STATUSES.map((s) => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              tab === s.id
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {s.label}
            <span className={`ml-1.5 text-xs ${tab === s.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>
              {counts[s.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
      {loading && <div className="text-sm text-[var(--text-muted)]">Cargando feedback…</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
          {tab === "pending" ? "No hay nada pendiente de revisar. 🎉" : "Nada por aquí."}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {item.author.avatarUrl ? (
                  <Image
                    src={item.author.avatarUrl}
                    alt={item.author.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs font-semibold shrink-0">
                    {item.author.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.author.name}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{item.author.email}</div>
                </div>
              </div>
              <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatDate(item.createdAt)}</div>
            </div>

            <div>
              <h2 className="font-display font-semibold text-base">{item.subject}</h2>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-1">{item.message}</p>
            </div>

            {item.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.images.map((url) => (
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

            {item.feature && (
              <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl px-3 py-2">
                En el roadmap como{" "}
                <Link href="/admin/features" prefetch={false} className="font-medium hover:underline">
                  {item.feature.title}
                </Link>{" "}
                <span style={{ color: featureStatusAccent(item.feature.status) }}>
                  · {featureStatusLabel(item.feature.status)}
                </span>{" "}
                · {item.feature.votes} voto{item.feature.votes === 1 ? "" : "s"}
              </div>
            )}

            {item.adminNote && (
              <div className="text-xs text-[var(--text-secondary)] border-l-2 border-[var(--border)] pl-3">
                Nota: {item.adminNote}
              </div>
            )}

            {item.reviewedAt && (
              <div className="text-xs text-[var(--text-muted)]">
                Revisado {formatDate(item.reviewedAt)}
                {item.reviewedBy ? ` por ${item.reviewedBy}` : ""}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {item.status === "pending" ? (
                <>
                  <button
                    onClick={() => openReview(item, "accept")}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  >
                    Aceptar y publicar
                  </button>
                  <button
                    onClick={() => openReview(item, "reject")}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-red-500 transition-colors"
                  >
                    Descartar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => reopen(item)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-purple-600 transition-colors"
                >
                  Volver a pendientes
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Modal de triaje */}
      {reviewing && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && setReviewing(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-semibold mb-1">
              {reviewing.action === "accept" ? "Publicar en el roadmap" : "Descartar propuesta"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {reviewing.action === "accept"
                ? "Redacta cómo quieres que la vean los usuarios. Podrán votarla desde el roadmap."
                : "Puedes dejar una nota explicando por qué. Si avisas al autor, la verá en el email."}
            </p>

            {reviewing.action === "accept" && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Vincular a una propuesta existente
                  </label>
                  <select
                    value={linkTo}
                    onChange={(e) => setLinkTo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm"
                  >
                    <option value="">Crear una propuesta nueva</option>
                    {features.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title} ({f.votes} voto{f.votes === 1 ? "" : "s"})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Úsalo si varios usuarios piden lo mismo: los votos se acumulan en una sola.
                  </p>
                </div>

                {!linkTo && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Título</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        Descripción
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={2000}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Estado</label>
                      <select
                        value={featureStatus}
                        onChange={(e) => setFeatureStatus(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm"
                      >
                        {FEATURE_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} — {s.hint}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Nota para el autor <span className="text-[var(--text-muted)] font-normal">(opcional)</span>
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm resize-none"
                placeholder={
                  reviewing.action === "accept"
                    ? "Gracias, nos encaja con lo que queríamos hacer…"
                    : "Ahora mismo no encaja con el enfoque de la app…"
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-4 cursor-pointer">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-purple-600" />
              Avisar por email a {reviewing.item.author.name}
            </label>

            {modalError && <p className="text-sm text-red-500 mb-3">{modalError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewing(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]"
              >
                Cancelar
              </button>
              <button
                onClick={submitReview}
                disabled={saving}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
                  reviewing.action === "accept"
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {saving ? "Guardando…" : reviewing.action === "accept" ? "Publicar" : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de capturas */}
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
